import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const DEFAULT_IOS_STORE = 'https://apps.apple.com/app/id6763769377';
const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.tofahastore.app';
const DEFAULT_UPDATE_MESSAGE =
  'يتوفر تحديث جديد لتطبيق تفاحة. يجب تحديث التطبيق للمتابعة.';

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
        forceUpdate: dto.forceUpdate ?? false,
        minIosVersion: dto.minIosVersion ?? null,
        minAndroidVersion: dto.minAndroidVersion ?? null,
        updateMessage: dto.updateMessage ?? null,
        iosStoreUrl: dto.iosStoreUrl ?? null,
        androidStoreUrl: dto.androidStoreUrl ?? null,
      },
      update: dto,
    });
  }

  async getAppVersionPolicy() {
    const store = await this.getStore();
    return {
      forceUpdate: store.forceUpdate,
      minIosVersion: store.minIosVersion,
      minAndroidVersion: store.minAndroidVersion,
      message: store.updateMessage || DEFAULT_UPDATE_MESSAGE,
      iosStoreUrl: store.iosStoreUrl || DEFAULT_IOS_STORE,
      androidStoreUrl: store.androidStoreUrl || DEFAULT_ANDROID_STORE,
    };
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
