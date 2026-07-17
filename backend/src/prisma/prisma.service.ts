import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async touchCatalogVersion() {
    await this.catalogMeta.upsert({
      where: { id: 'version' },
      create: { id: 'version' },
      update: {},
    });
  }
}
