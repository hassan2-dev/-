import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeIraqiPhone } from '../common/utils/phone.util';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { AssignDriverDto } from '../drivers/dto/driver.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async addTimeline(
    orderId: string,
    status: string,
    createdBy?: string | null,
    note?: string | null,
  ) {
    await this.prisma.orderTimeline.create({
      data: {
        orderId,
        status,
        createdBy: createdBy || null,
        note: note || null,
      },
    });
  }

  async create(user: AuthUser, dto: CreateOrderDto) {
    const phone = normalizeIraqiPhone(dto.phone);
    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        name: dto.name,
        phone,
        address: dto.address,
        email: dto.email,
        items: dto.items as unknown as Prisma.InputJsonValue,
        total: new Prisma.Decimal(dto.total),
        totalDiscount: new Prisma.Decimal(dto.totalDiscount ?? 0),
        paymentMethod: dto.paymentMethod || 'نقدي',
        isScheduled: dto.isScheduled ?? false,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: OrderStatus.PENDING,
        statusUpdatedAt: new Date(),
      },
    });

    await this.addTimeline(order.id, 'Created', user.id, 'تم إنشاء الطلب');

    await this.prisma.notification.create({
      data: {
        userId: user.id,
        orderId: order.id,
        title: 'تم استلام طلبك',
        body: `طلبك رقم ${order.id.slice(-6)} قيد المراجعة`,
        phone,
        status: OrderStatus.PENDING,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ORDER_CREATED',
        entity: 'Order',
        entityId: order.id,
        metadata: { total: dto.total },
      },
    });

    return order;
  }

  async findMine(user: AuthUser) {
    return this.prisma.order.findMany({
      where: {
        OR: [{ userId: user.id }, { phone: user.phone }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMineDriver(user: AuthUser) {
    return this.prisma.order.findMany({
      where: { driverId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async findAll(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        driver: {
          select: { id: true, name: true, username: true, presence: true },
        },
      },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        driver: {
          select: { id: true, name: true, username: true, presence: true },
        },
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    if (user.role === Role.ADMIN) return order;
    if (user.role === Role.DRIVER) {
      if (order.driverId !== user.id) throw new ForbiddenException();
      return order;
    }
    if (order.userId !== user.id && order.phone !== user.phone) {
      throw new ForbiddenException();
    }
    return order;
  }

  async assignDriver(id: string, user: AuthUser, dto: AssignDriverDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    const driver = await this.prisma.user.findFirst({
      where: { id: dto.driverId, role: Role.DRIVER, isActive: true },
    });
    if (!driver) throw new NotFoundException('المندوب غير موجود أو غير مفعّل');

    if (order.driverId && order.driverId !== dto.driverId && !dto.confirmReassign) {
      const current = await this.prisma.user.findUnique({
        where: { id: order.driverId },
        select: { name: true, username: true },
      });
      throw new ConflictException({
        code: 'ALREADY_ASSIGNED',
        message: `هذا الطلب معيّن مسبقاً لـ ${current?.name || current?.username || 'مندوب'}`,
        currentDriverId: order.driverId,
        currentDriverName: current?.name || current?.username,
      });
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        driverId: dto.driverId,
        assignedAt: new Date(),
        statusUpdatedAt: new Date(),
        updatedBy: user.id,
        // Reset acceptance if reassigned
        ...(order.driverId && order.driverId !== dto.driverId
          ? { acceptedAt: null, pickedAt: null }
          : {}),
      },
      include: {
        driver: {
          select: { id: true, name: true, username: true, presence: true },
        },
      },
    });

    await this.addTimeline(
      id,
      'Assigned',
      user.id,
      `تعيين للمندوب ${driver.name || driver.username}`,
    );

    await this.prisma.notification.create({
      data: {
        userId: dto.driverId,
        orderId: id,
        title: 'لديك طلب جديد',
        body: `تم تعيين طلب #${id.slice(-6)} لك — ${order.name}`,
        phone: driver.phone,
        status: 'Assigned',
      },
    });

    return updated;
  }

  async updateStatus(id: string, user: AuthUser, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    if (user.role === Role.DRIVER) {
      if (order.driverId !== user.id) {
        throw new ForbiddenException('هذا الطلب غير معيّن لك');
      }
      const allowed: OrderStatus[] = [
        OrderStatus.ACCEPTED,
        OrderStatus.ON_THE_WAY,
        OrderStatus.DELIVERED,
        OrderStatus.DELIVERY_FAILED,
      ];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException('حالة غير مسموحة للمندوب');
      }
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = {
      status: dto.status,
      statusUpdatedAt: now,
      updatedBy: user.id,
    };

    if (dto.status === OrderStatus.ACCEPTED) data.acceptedAt = now;
    if (dto.status === OrderStatus.ON_THE_WAY) data.pickedAt = now;
    if (dto.status === OrderStatus.DELIVERED) data.deliveredAt = now;
    if (dto.status === OrderStatus.DELIVERY_FAILED) data.failedAt = now;

    const updated = await this.prisma.order.update({
      where: { id },
      data,
      include: {
        driver: {
          select: { id: true, name: true, username: true, presence: true },
        },
      },
    });

    const timelineMap: Record<string, string> = {
      [OrderStatus.ACCEPTED]: 'Accepted',
      [OrderStatus.PREPARING]: 'Preparing',
      [OrderStatus.ON_THE_WAY]: 'OnTheWay',
      [OrderStatus.DELIVERED]: 'Delivered',
      [OrderStatus.CANCELLED]: 'Cancelled',
      [OrderStatus.DELIVERY_FAILED]: 'Failed',
    };
    await this.addTimeline(
      id,
      timelineMap[dto.status] || dto.status,
      user.id,
    );

    const STATUS_NOTIFICATIONS: Record<string, { title: string; body: string }> = {
      [OrderStatus.ACCEPTED]: {
        title: 'تم قبول طلبك ✅',
        body: 'تمت الموافقة على طلبك وسيتم تجهيزه قريباً',
      },
      [OrderStatus.PREPARING]: {
        title: 'جاري تجهيز طلبك 👨‍🍳',
        body: 'طلبك قيد التجهيز الآن',
      },
      [OrderStatus.ON_THE_WAY]: {
        title: 'طلبك في الطريق 🚚',
        body: 'السائق في طريقه إليك، استعد لاستلام الطلب',
      },
      [OrderStatus.DELIVERED]: {
        title: 'تم توصيل طلبك 🎉',
        body: 'نتمنى لك تجربة ممتعة، شكراً لتسوقك من متجر تفاحة',
      },
      [OrderStatus.CANCELLED]: {
        title: 'تم إلغاء طلبك ❌',
        body: 'نعتذر، تم إلغاء طلبك. للاستفسار تواصل معنا',
      },
      [OrderStatus.DELIVERY_FAILED]: {
        title: 'تعذر تسليم الطلب',
        body: 'تعذر إتمام توصيل طلبك. سنتواصل معك قريباً',
      },
    };
    const message = STATUS_NOTIFICATIONS[dto.status] || {
      title: 'تحديث حالة الطلب',
      body: 'تم تحديث حالة طلبك',
    };

    // Customer notification
    if (user.role !== Role.DRIVER || dto.status !== OrderStatus.ACCEPTED) {
      await this.prisma.notification.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          title: message.title,
          body: message.body,
          phone: order.phone,
          status: dto.status,
        },
      });
    }

    // Admin sees driver accepted via acceptedAt; also notify if driver accepted
    if (user.role === Role.DRIVER && dto.status === OrderStatus.ACCEPTED) {
      await this.prisma.notification.create({
        data: {
          orderId: order.id,
          title: 'Driver Accepted',
          body: `المندوب قبل الطلب #${order.id.slice(-6)}`,
          status: 'DriverAccepted',
        },
      });
      await this.prisma.notification.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          title: message.title,
          body: message.body,
          phone: order.phone,
          status: dto.status,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ORDER_STATUS_UPDATED',
        entity: 'Order',
        entityId: id,
        metadata: { from: order.status, to: dto.status },
      },
    });

    // Touch driver lastSeen
    if (user.role === Role.DRIVER) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastSeen: now },
      });
    }

    return updated;
  }
}
