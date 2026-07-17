import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { children: true },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!category) throw new NotFoundException('التصنيف غير موجود');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({ data: dto });
    await this.prisma.touchCatalogVersion();
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        image: dto.image,
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
      },
    });
    await this.prisma.touchCatalogVersion();
    return category;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.category.delete({ where: { id } });
    await this.prisma.touchCatalogVersion();
    return { deleted: true };
  }
}
