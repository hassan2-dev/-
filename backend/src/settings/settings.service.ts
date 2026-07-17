import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStore() {
    return this.prisma.storeSettings.upsert({
      where: { id: 'store' },
      create: { id: 'store' },
      update: {},
    });
  }

  async updateStore(dto: UpdateSettingsDto) {
    return this.prisma.storeSettings.upsert({
      where: { id: 'store' },
      create: {
        id: 'store',
        openTime: dto.openTime ?? '09:00',
        closeTime: dto.closeTime ?? '22:00',
        timezone: dto.timezone ?? 'Asia/Baghdad',
        enabled: dto.enabled ?? true,
      },
      update: dto,
    });
  }

  async getCatalogVersion() {
    const meta = await this.prisma.catalogMeta.upsert({
      where: { id: 'version' },
      create: { id: 'version' },
      update: {},
    });
    return { updatedAt: meta.updatedAt };
  }
}
