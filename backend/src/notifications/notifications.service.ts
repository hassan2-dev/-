import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  BroadcastDto,
  RegisterPushTokenDto,
} from './dto/notification.dto';
import { ExpoPushService } from './expo-push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {}

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

  async broadcast(dto: BroadcastDto) {
    const notification = await this.prisma.notification.create({
      data: {
        title: dto.title,
        body: dto.body,
        broadcast: true,
      },
    });

    const pushData: Record<string, string> = {
      broadcast: 'true',
      ...(dto.data || {}),
    };

    const push = await this.expoPush.sendBroadcast({
      title: dto.title,
      body: dto.body,
      data: pushData,
      channelId: 'general',
    });

    return { notification, push };
  }

  pushTokenStats() {
    return this.expoPush.countTokens().then((devices) => ({ devices }));
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
