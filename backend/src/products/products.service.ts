import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { paginate, parsePageLimit } from '../common/utils/pagination.util';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(categoryId?: string) {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAdmin(query: {
    page?: number;
    limit?: number;
    q?: string;
    categoryId?: string;
    status?: string;
    sort?: string;
  }) {
    const { page, limit, skip } = parsePageLimit(query.page, query.limit);
    const where: Prisma.ProductWhereInput = {};

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status === 'active') where.isActive = true;
    if (query.status === 'hidden') where.isActive = false;
    if (query.status === 'out_of_stock') {
      where.stock = 0;
      where.isActive = true;
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    switch (query.sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'name_asc':
        orderBy = { name: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'updated':
        orderBy = { updatedAt: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async exportCsv(query: {
    q?: string;
    categoryId?: string;
    status?: string;
    sort?: string;
  }) {
    const result = await this.findAdmin({
      ...query,
      page: 1,
      limit: 100,
    });
    // Fetch all matching in chunks
    const all: typeof result.items = [...result.items];
    for (let p = 2; p <= result.totalPages; p += 1) {
      const next = await this.findAdmin({ ...query, page: p, limit: 100 });
      all.push(...next.items);
    }

    const header = [
      'id',
      'name',
      'category',
      'price',
      'stock',
      'sku',
      'barcode',
      'isActive',
      'createdAt',
    ];
    const rows = all.map((p) =>
      [
        p.id,
        JSON.stringify(p.name),
        JSON.stringify(p.category?.name || ''),
        String(p.price),
        String(p.stock),
        JSON.stringify(p.sku || ''),
        JSON.stringify(p.barcode || ''),
        p.isActive ? '1' : '0',
        p.createdAt.toISOString(),
      ].join(','),
    );
    return `${header.join(',')}\n${rows.join('\n')}`;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    return product;
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        price: new Prisma.Decimal(dto.price),
        originalPrice:
          dto.originalPrice !== undefined
            ? new Prisma.Decimal(dto.originalPrice)
            : undefined,
        hasDiscount: dto.hasDiscount ?? false,
        discountPercent: dto.discountPercent,
        image: dto.image,
        image1: dto.image1,
        image2: dto.image2,
        images: dto.images as Prisma.InputJsonValue | undefined,
        stock: dto.stock ?? 0,
        sku: dto.sku,
        barcode: dto.barcode,
        isActive: dto.isActive ?? true,
      },
    });
    await this.prisma.touchCatalogVersion();
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        originalPrice:
          dto.originalPrice === undefined
            ? undefined
            : dto.originalPrice === null
              ? null
              : new Prisma.Decimal(dto.originalPrice),
        hasDiscount: dto.hasDiscount,
        discountPercent: dto.discountPercent,
        image: dto.image,
        image1: dto.image1,
        image2: dto.image2,
        images:
          dto.images === undefined
            ? undefined
            : dto.images === null
              ? Prisma.DbNull
              : (dto.images as Prisma.InputJsonValue),
        isActive: dto.isActive,
        stock: dto.stock,
        sku: dto.sku,
        barcode: dto.barcode,
      },
    });
    await this.prisma.touchCatalogVersion();
    return product;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    await this.prisma.touchCatalogVersion();
    return { deleted: true };
  }

  async bulkDelete(ids: string[]) {
    const result = await this.prisma.product.deleteMany({
      where: { id: { in: ids } },
    });
    await this.prisma.touchCatalogVersion();
    return { deleted: result.count };
  }
}
