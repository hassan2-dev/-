import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeIraqiPhone } from '../common/utils/phone.util';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
        isScheduled: dto.isScheduled ?? false,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: OrderStatus.PENDING,
        statusUpdatedAt: new Date(),
      },
    });

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

  async findAll(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (
      user.role !== Role.ADMIN &&
      order.userId !== user.id &&
      order.phone !== user.phone
    ) {
      throw new ForbiddenException();
    }
    return order;
  }

  async updateStatus(id: string, user: AuthUser, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        statusUpdatedAt: new Date(),
        updatedBy: user.id,
      },
    });

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
    };
    const message = STATUS_NOTIFICATIONS[dto.status] || {
      title: 'تحديث حالة الطلب',
      body: 'تم تحديث حالة طلبك',
    };

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

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ORDER_STATUS_UPDATED',
        entity: 'Order',
        entityId: id,
        metadata: { from: order.status, to: dto.status },
      },
    });

    return updated;
  }
}
