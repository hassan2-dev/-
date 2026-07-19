import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { paginate, parsePageLimit } from '../common/utils/pagination.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { children: true },
    });
  }

  /** Public list including inactive for admin select — use findAdmin for tables */
  findAllRaw() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { children: true, _count: { select: { products: true } } },
    });
  }

  async findAdmin(query: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    sort?: string;
  }) {
    const { page, limit, skip } = parsePageLimit(query.page, query.limit);
    const where: Prisma.CategoryWhereInput = {};

    if (query.status === 'active') where.isActive = true;
    if (query.status === 'hidden') where.isActive = false;
    if (query.q?.trim()) {
      where.name = { contains: query.q.trim(), mode: 'insensitive' };
    }

    let orderBy: Prisma.CategoryOrderByWithRelationInput = { createdAt: 'desc' };
    switch (query.sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'name':
      case 'name_asc':
        orderBy = { name: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: { _count: { select: { products: true } } },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('التصنيف غير موجود');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        image: dto.image,
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
      },
    });
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
        isActive: dto.isActive,
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

  async bulkDelete(ids: string[]) {
    const result = await this.prisma.category.deleteMany({
      where: { id: { in: ids } },
    });
    await this.prisma.touchCatalogVersion();
    return { deleted: result.count };
  }
}
