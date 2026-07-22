import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        address: dto.address,
        email: dto.email,
        apartment:
          dto.apartment === undefined
            ? undefined
            : (dto.apartment as Prisma.InputJsonValue),
      },
    });
  }

  /** Hard-delete account + personal data (Apple 5.1.1(v)). */
  async deleteMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (user.role === Role.ADMIN) {
      throw new ForbiddenException('لا يمكن حذف حساب الإدارة من التطبيق');
    }

    const anonymizedPhone = `deleted_${user.id.slice(-10)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.pushToken.deleteMany({
        where: { OR: [{ userId }, { phone: user.phone }] },
      });
      await tx.notification.deleteMany({
        where: { OR: [{ userId }, { phone: user.phone }] },
      });
      await tx.otpCode.deleteMany({ where: { phone: user.phone } });
      await tx.driverSession.deleteMany({ where: { userId } });

      // Keep order history for the store, but strip personal data.
      await tx.order.updateMany({
        where: { OR: [{ userId }, { phone: user.phone }] },
        data: {
          userId: null,
          name: 'حساب محذوف',
          phone: anonymizedPhone,
          email: null,
          address: 'محذوف',
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ACCOUNT_DELETED',
          entity: 'User',
          entityId: userId,
          metadata: { phoneLast4: user.phone.slice(-4) },
        },
      });

      await tx.user.delete({ where: { id: userId } });
    });

    return {
      deleted: true,
      message: 'تم حذف حسابك وبياناتك نهائياً',
    };
  }
}
