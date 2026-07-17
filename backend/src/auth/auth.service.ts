import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../common/sms/sms-provider.interface';
import { isValidIraqiMobile, normalizeIraqiPhone } from '../common/utils/phone.util';
import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const phone = normalizeIraqiPhone(dto.phone);
    if (!isValidIraqiMobile(phone)) {
      throw new BadRequestException('رقم هاتف عراقي غير صالح');
    }

    const length = this.config.get<number>('otp.length', 6);
    const expiresSeconds = this.config.get<number>('otp.expiresSeconds', 300);
    const devMode = this.config.get<boolean>('otp.devMode', false);
    const code = devMode
      ? this.config.get<string>('otp.devCode', '123456')
      : String(randomInt(0, 10 ** length)).padStart(length, '0');

    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000);

    await this.prisma.otpCode.updateMany({
      where: { phone, consumed: false },
      data: { consumed: true },
    });

    await this.prisma.otpCode.create({
      data: { phone, codeHash, expiresAt },
    });

    await this.sms.sendOtp(phone, code);

    return {
      phone,
      expiresIn: expiresSeconds,
      ...(devMode ? { devCode: code } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = normalizeIraqiPhone(dto.phone);
    const maxAttempts = this.config.get<number>('otp.maxAttempts', 5);

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('رمز التحقق منتهي أو غير موجود');
    }

    if (otp.attempts >= maxAttempts) {
      throw new UnauthorizedException('تجاوزت عدد المحاولات المسموح');
    }

    const valid = await bcrypt.compare(dto.code, otp.codeHash);
    if (!valid) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('رمز التحقق غير صحيح');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true },
    });

    const adminPhones = this.config.get<string[]>('adminPhones', []);
    const role: Role = adminPhones.includes(phone) ? Role.ADMIN : Role.CUSTOMER;

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone, role },
      update: {},
    });

    if (!user.isActive) {
      throw new UnauthorizedException('الحساب غير مفعّل');
    }

    return this.issueTokens(user.id, user.phone, user.role);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('جلسة غير صالحة');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(
      stored.user.id,
      stored.user.phone,
      stored.user.role,
    );
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, phone: string, role: Role) {
    const payload = { sub: userId, phone, role };
    const accessExpires = this.config.get<string>('jwt.accessExpires', '15m');
    const refreshExpires = this.config.get<string>('jwt.refreshExpires', '30d');
    const secret = this.config.getOrThrow<string>('jwt.secret');

    const accessToken = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: accessExpires as `${number}m` | `${number}d`,
    });

    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: 'refresh' },
      {
        secret,
        expiresIn: refreshExpires as `${number}m` | `${number}d`,
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        address: user.address,
        apartment: user.apartment,
      },
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
