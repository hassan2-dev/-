import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';

@Injectable()
export class HttpSmsProvider implements SmsProvider {
  private readonly logger = new Logger(HttpSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const url = this.config.get<string>('sms.httpUrl');
    const apiKey = this.config.get<string>('sms.httpApiKey');
    const sender = this.config.get<string>('sms.senderName', 'Tofaha');

    if (!url) {
      throw new Error('SMS_HTTP_URL is not configured');
    }

    const message = `رمز التحقق من تفاحة: ${code}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ phone, message, sender, code }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`SMS failed: ${res.status} ${text}`);
      throw new Error('Failed to send SMS');
    }
  }
}
