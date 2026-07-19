import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PresenceStatus,
  Prisma,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeIraqiPhone } from '../common/utils/phone.util';
import {
  computeDriverAvailability,
  OPEN_DRIVER_ORDER_STATUSES,
} from '../common/utils/driver-status.util';
import {
  CreateDriverDto,
  ResetDriverPasswordDto,
  UpdateDriverDto,
} from './dto/driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  private async openOrdersCount(driverId: string) {
    return this.prisma.order.count({
      where: {
        driverId,
        status: { in: OPEN_DRIVER_ORDER_STATUSES },
      },
    });
  }

  private async mapDriver(user: {
    id: string;
    name: string | null;
    username: string | null;
    phone: string;
    presence: PresenceStatus;
    lastSeen: Date | null;
    isActive: boolean;
    createdAt: Date;
  }) {
    const activeOrdersCount = await this.openOrdersCount(user.id);
    const availability = computeDriverAvailability(
      user.presence,
      activeOrdersCount,
    );
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      phone: user.phone,
      presence: user.presence,
      availability,
      activeOrdersCount,
      lastSeen: user.lastSeen,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async list() {
    const users = await this.prisma.user.findMany({
      where: { role: Role.DRIVER },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        presence: true,
        lastSeen: true,
        isActive: true,
        createdAt: true,
      },
    });
    return Promise.all(users.map((u) => this.mapDriver(u)));
  }

  async stats() {
    const drivers = await this.list();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayOrders, todayDelivered, todayFailed, deliveredWithTimes] =
      await Promise.all([
        this.prisma.order.count({
          where: { createdAt: { gte: startOfDay } },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.DELIVERED,
            deliveredAt: { gte: startOfDay },
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.DELIVERY_FAILED,
            failedAt: { gte: startOfDay },
          },
        }),
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.DELIVERED,
            deliveredAt: { gte: startOfDay },
            assignedAt: { not: null },
          },
          select: { assignedAt: true, deliveredAt: true },
          take: 200,
        }),
      ]);

    let avgDeliveryMinutes: number | null = null;
    if (deliveredWithTimes.length) {
      const totalMs = deliveredWithTimes.reduce((sum, o) => {
        if (!o.assignedAt || !o.deliveredAt) return sum;
        return sum + (o.deliveredAt.getTime() - o.assignedAt.getTime());
      }, 0);
      avgDeliveryMinutes = Math.round(totalMs / deliveredWithTimes.length / 60000);
    }

    return {
      driversTotal: drivers.length,
      available: drivers.filter((d) => d.availability === 'available').length,
      busy: drivers.filter((d) => d.availability === 'busy').length,
      offline: drivers.filter((d) => d.availability === 'offline').length,
      online: drivers.filter((d) => d.presence === PresenceStatus.ONLINE).length,
      todayOrders,
      todayDelivered,
      todayFailed,
      averageDeliveryMinutes: avgDeliveryMinutes,
    };
  }

  async create(dto: CreateDriverDto) {
    const phone = normalizeIraqiPhone(dto.phone);
    const username = dto.username.trim().toLowerCase();

    const [byUser, byPhone] = await Promise.all([
      this.prisma.user.findUnique({ where: { username } }),
      this.prisma.user.findUnique({ where: { phone } }),
    ]);
    if (byUser) throw new ConflictException('اسم المستخدم مستخدم مسبقاً');
    if (byPhone) throw new ConflictException('رقم الهاتف مستخدم مسبقاً');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        phone,
        name: dto.name,
        username,
        passwordHash,
        role: Role.DRIVER,
        presence: PresenceStatus.OFFLINE,
        isActive: true,
      },
    });
    return this.mapDriver(user);
  }

  async update(id: string, dto: UpdateDriverDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: Role.DRIVER },
    });
    if (!user) throw new NotFoundException('المندوب غير موجود');

    let phone = user.phone;
    if (dto.phone) {
      phone = normalizeIraqiPhone(dto.phone);
      if (phone !== user.phone) {
        const clash = await this.prisma.user.findUnique({ where: { phone } });
        if (clash) throw new ConflictException('رقم الهاتف مستخدم مسبقاً');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        phone,
        isActive: dto.isActive,
      },
    });
    return this.mapDriver(updated);
  }

  async resetPassword(id: string, dto: ResetDriverPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: Role.DRIVER },
    });
    if (!user) throw new NotFoundException('المندوب غير موجود');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async remove(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: Role.DRIVER },
    });
    if (!user) throw new NotFoundException('المندوب غير موجود');

    const open = await this.openOrdersCount(id);
    if (open > 0) {
      throw new BadRequestException('لا يمكن حذف مندوب لديه طلبات نشطة');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, presence: PresenceStatus.OFFLINE },
    });
    return { deleted: true, soft: true };
  }

  async findOrders(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: Role.DRIVER },
    });
    if (!user) throw new NotFoundException('المندوب غير موجود');
    return this.prisma.order.findMany({
      where: { driverId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { id: true, name: true, username: true } },
      },
    });
  }

  async driverTodayStats(driverId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [todayAssigned, delivered, failed, open] = await Promise.all([
      this.prisma.order.count({
        where: { driverId, assignedAt: { gte: startOfDay } },
      }),
      this.prisma.order.count({
        where: {
          driverId,
          status: OrderStatus.DELIVERED,
          deliveredAt: { gte: startOfDay },
        },
      }),
      this.prisma.order.count({
        where: {
          driverId,
          status: OrderStatus.DELIVERY_FAILED,
          failedAt: { gte: startOfDay },
        },
      }),
      this.openOrdersCount(driverId),
    ]);
    return {
      todayOrders: todayAssigned,
      delivered,
      failed,
      open,
    };
  }
}
