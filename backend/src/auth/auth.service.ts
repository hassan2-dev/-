import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, PresenceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../common/sms/sms-provider.interface';
import { isValidIraqiMobile, normalizeIraqiPhone } from '../common/utils/phone.util';
import {
  AdminLoginDto,
  DriverLoginDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { OPEN_DRIVER_ORDER_STATUSES } from '../common/utils/driver-status.util';

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

    // Apple App Review account: pretend the SMS was sent, no real OTP needed.
    if (this.isReviewPhone(phone)) {
      return {
        phone,
        expiresIn: this.config.get<number>('otp.expiresSeconds', 300),
      };
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

    // Apple App Review account: fixed code, works ONLY for the review phone.
    if (this.isReviewPhone(phone)) {
      const reviewCode = this.config.get<string>('reviewAccount.code', '');
      if (!reviewCode || !this.safeEquals(dto.code, reviewCode)) {
        throw new UnauthorizedException('رمز التحقق غير صحيح');
      }

      // Always CUSTOMER: never let the review account carry admin privileges.
      const user = await this.prisma.user.upsert({
        where: { phone },
        create: { phone, role: Role.CUSTOMER, name: 'App Review' },
        update: { role: Role.CUSTOMER },
      });

      if (!user.isActive) {
        throw new UnauthorizedException('الحساب غير مفعّل');
      }

      return this.issueTokens(user.id, user.phone, Role.CUSTOMER);
    }

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

  async adminLogin(dto: AdminLoginDto) {
    const expectedUsername = this.config.get<string>('adminLogin.username', '');
    const expectedPassword = this.config.get<string>('adminLogin.password', '');

    if (!expectedUsername || !expectedPassword) {
      throw new UnauthorizedException('دخول الأدمن غير مفعّل على السيرفر');
    }

    const usernameOk = this.safeEquals(dto.username, expectedUsername);
    const passwordOk = this.safeEquals(dto.password, expectedPassword);
    if (!usernameOk || !passwordOk) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    // Fallback must NOT be the Apple review phone (07800000000).
    const adminPhones = this.config.get<string[]>('adminPhones', []);
    const phone = adminPhones[0] || '07899999999';

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone, role: Role.ADMIN, name: 'Admin' },
      update: { role: Role.ADMIN },
    });

    if (!user.isActive) {
      throw new UnauthorizedException('الحساب غير مفعّل');
    }

    return this.issueTokens(user.id, user.phone, user.role);
  }

  async driverLogin(
    dto: DriverLoginDto,
    meta: { ip?: string | null; device?: string | null } = {},
  ) {
    const username = String(dto.username || '')
      .trim()
      .toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.role !== Role.DRIVER || !user.passwordHash) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('الحساب غير مفعّل');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    const openCount = await this.prisma.order.count({
      where: {
        driverId: user.id,
        status: { in: OPEN_DRIVER_ORDER_STATUSES },
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        presence: PresenceStatus.ONLINE,
        lastSeen: new Date(),
      },
    });

    await this.prisma.driverSession.create({
      data: {
        userId: user.id,
        ip: meta.ip || null,
        device: meta.device || null,
      },
    });

    const tokens = await this.issueTokens(user.id, user.phone, Role.DRIVER);
    return {
      ...tokens,
      openOrdersCount: openCount,
    };
  }

  private isReviewPhone(phone: string): boolean {
    const reviewPhone = normalizeIraqiPhone(
      this.config.get<string>('reviewAccount.phone', ''),
    );
    return !!reviewPhone && phone === reviewPhone;
  }

  private safeEquals(a: string, b: string): boolean {
    const ha = createHash('sha256').update(String(a)).digest();
    const hb = createHash('sha256').update(String(b)).digest();
    return timingSafeEqual(ha, hb);
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
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });

    if (stored?.user?.role === Role.DRIVER) {
      await this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          presence: PresenceStatus.OFFLINE,
          lastSeen: new Date(),
        },
      });
      const openSession = await this.prisma.driverSession.findFirst({
        where: { userId: stored.userId, logoutAt: null },
        orderBy: { loginAt: 'desc' },
      });
      if (openSession) {
        await this.prisma.driverSession.update({
          where: { id: openSession.id },
          data: { logoutAt: new Date() },
        });
      }
    }

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
        username: user.username,
        address: user.address,
        apartment: user.apartment,
      },
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
