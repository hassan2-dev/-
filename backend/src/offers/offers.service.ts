import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMediaDto, UpdateMediaDto } from '../banners/dto/media.dto';

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.offer.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateMediaDto) {
    const offer = await this.prisma.offer.create({
      data: { image: dto.image, sortOrder: dto.sortOrder ?? 0 },
    });
    await this.prisma.touchCatalogVersion();
    return offer;
  }

  async update(id: string, dto: UpdateMediaDto) {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('العرض غير موجود');
    const offer = await this.prisma.offer.update({ where: { id }, data: dto });
    await this.prisma.touchCatalogVersion();
    return offer;
  }

  async remove(id: string) {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('العرض غير موجود');
    await this.prisma.offer.delete({ where: { id } });
    await this.prisma.touchCatalogVersion();
    return { deleted: true };
  }
}
