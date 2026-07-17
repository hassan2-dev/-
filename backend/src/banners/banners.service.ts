import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMediaDto, UpdateMediaDto } from './dto/media.dto';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateMediaDto) {
    const banner = await this.prisma.banner.create({
      data: { image: dto.image, sortOrder: dto.sortOrder ?? 0 },
    });
    await this.prisma.touchCatalogVersion();
    return banner;
  }

  async update(id: string, dto: UpdateMediaDto) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('البانر غير موجود');
    const banner = await this.prisma.banner.update({ where: { id }, data: dto });
    await this.prisma.touchCatalogVersion();
    return banner;
  }

  async remove(id: string) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('البانر غير موجود');
    await this.prisma.banner.delete({ where: { id } });
    await this.prisma.touchCatalogVersion();
    return { deleted: true };
  }
}
