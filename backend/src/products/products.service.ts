import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

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
}
