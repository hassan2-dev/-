import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: 'orders' | 'general';
};

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async countTokens() {
    return this.prisma.pushToken.count();
  }

  async sendToUser(
    target: { userId?: string | null; phone?: string | null },
    payload: PushPayload,
  ) {
    const or: Array<{ userId?: string; phone?: string }> = [];
    if (target.userId) or.push({ userId: target.userId });
    if (target.phone) or.push({ phone: target.phone });
    if (!or.length) return { sent: 0, errors: 0, devices: 0 };

    const rows = await this.prisma.pushToken.findMany({
      where: { OR: or },
      select: { token: true },
    });
    const tokens = [...new Set(rows.map((r) => r.token).filter(Boolean))];
    return this.sendToTokens(tokens, payload);
  }

  async sendBroadcast(payload: PushPayload) {
    const rows = await this.prisma.pushToken.findMany({
      select: { token: true },
    });
    const tokens = [...new Set(rows.map((r) => r.token).filter(Boolean))];
    return this.sendToTokens(tokens, { ...payload, channelId: payload.channelId || 'general' });
  }

  async sendToTokens(tokens: string[], payload: PushPayload) {
    const unique = [...new Set((tokens || []).filter(Boolean))];
    if (!unique.length) return { sent: 0, errors: 0, devices: 0 };

    const messages = unique.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: 'default' as const,
      channelId: payload.channelId || 'orders',
    }));

    let sent = 0;
    let errors = 0;

    try {
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const result = await this.sendBatch(chunk);
        sent += result.sent;
        errors += result.errors;
      }
    } catch (error) {
      this.logger.warn(
        `Expo push failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { sent, errors: unique.length - sent, devices: unique.length };
    }

    return { sent, errors, devices: unique.length };
  }

  private async sendBatch(
    messages: Array<{
      to: string;
      title: string;
      body: string;
      data: Record<string, string>;
      sound: 'default';
      channelId: string;
    }>,
  ) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`expo_push_${response.status}:${JSON.stringify(data)}`);
    }

    const tickets = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [data];
    const errorCount = tickets.filter((t: { status?: string }) => t?.status === 'error').length;
    return { sent: messages.length - errorCount, errors: errorCount };
  }
}
