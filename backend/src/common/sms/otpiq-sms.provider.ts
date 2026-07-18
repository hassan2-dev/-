import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';

/**
 * OTPIQ provider (https://otpiq.com) — sends OTP via WhatsApp/SMS in Iraq.
 *
 * Two modes:
 *  - verification (default): OTPIQ picks its own approved sender/template.
 *    Uses OTPIQ_PROVIDER channel (whatsapp-sms => WhatsApp first, fallback SMS).
 *  - whatsapp-template: sends via YOUR connected WhatsApp Business number using
 *    an approved authentication template. Enabled when the three template env
 *    vars are set.
 */
@Injectable()
export class OtpiqSmsProvider implements SmsProvider {
  private readonly logger = new Logger(OtpiqSmsProvider.name);
  private readonly endpoint = 'https://api.otpiq.com/api/sms';

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('otpiq.apiKey');
    if (!apiKey) {
      throw new Error('OTPIQ_API_KEY is not configured');
    }

    const phoneNumber = this.toInternational(phone);
    const channel = this.config.get<string>('otpiq.provider', 'whatsapp-sms');

    const templateName = this.config.get<string>('otpiq.templateName');
    const whatsappAccountId = this.config.get<string>('otpiq.whatsappAccountId');
    const whatsappPhoneId = this.config.get<string>('otpiq.whatsappPhoneId');

    const useTemplate = Boolean(
      templateName && whatsappAccountId && whatsappPhoneId,
    );

    const body: Record<string, unknown> = useTemplate
      ? {
          phoneNumber,
          smsType: 'whatsapp-template',
          provider: channel,
          templateName,
          whatsappAccountId,
          whatsappPhoneId,
          templateParameters: { body: { '1': code } },
        }
      : {
          phoneNumber,
          smsType: 'verification',
          provider: channel,
          verificationCode: code,
        };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`OTPIQ send failed: ${res.status} ${text}`);
      let data: { message?: string; error?: string; waitMinutes?: number } = {};
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        // Keep a safe user-facing message when OTPIQ returns non-JSON.
      }

      if (res.status === HttpStatus.TOO_MANY_REQUESTS) {
        const wait = Number(data.waitMinutes);
        const message =
          Number.isFinite(wait) && wait > 0
            ? `تجاوزت الحد المسموح لطلب رمز التحقق. حاول بعد ${wait} دقيقة`
            : 'تجاوزت الحد المسموح لطلب رمز التحقق. حاول لاحقاً';
        throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
      }

      throw new ServiceUnavailableException(
        'تعذر إرسال رمز التحقق حالياً، حاول مرة أخرى لاحقاً',
      );
    }

    const data = (await res.json().catch(() => ({}))) as {
      smsId?: string;
      remainingCredit?: number;
    };
    this.logger.log(
      `OTPIQ OTP queued for ${phoneNumber} (smsId=${data.smsId ?? '?'}, credit=${data.remainingCredit ?? '?'})`,
    );
  }

  /** Convert an Iraqi phone to international digits without '+': 07XXXXXXXXX → 9647XXXXXXXXX. */
  private toInternational(phone: string): string {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('964')) return digits;
    if (digits.startsWith('0')) return `964${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('7')) return `964${digits}`;
    return digits;
  }
}
