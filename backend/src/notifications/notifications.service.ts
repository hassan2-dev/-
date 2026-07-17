import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  BroadcastDto,
  RegisterPushTokenDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(user: AuthUser) {
    return this.prisma.notification.findMany({
      where: {
        OR: [
          { userId: user.id },
          { phone: user.phone },
          { broadcast: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string, user: AuthUser) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException();
    if (
      notification.userId &&
      notification.userId !== user.id &&
      notification.phone !== user.phone &&
      !notification.broadcast
    ) {
      throw new NotFoundException();
    }
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  broadcast(dto: BroadcastDto) {
    return this.prisma.notification.create({
      data: {
        title: dto.title,
        body: dto.body,
        broadcast: true,
      },
    });
  }

  registerPushToken(user: AuthUser, dto: RegisterPushTokenDto) {
    return this.prisma.pushToken.upsert({
      where: { token: dto.token },
      create: {
        token: dto.token,
        userId: user.id,
        phone: dto.phone || user.phone,
        platform: dto.platform,
      },
      update: {
        userId: user.id,
        phone: dto.phone || user.phone,
        platform: dto.platform,
      },
    });
  }
}
