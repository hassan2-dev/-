import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';
import { BulkIdsDto } from '../drivers/dto/driver.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    return this.products.findAll(categoryId);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('admin')
  findAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    return this.products.findAdmin({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      categoryId,
      status,
      sort,
    });
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('export')
  async export(
    @Query('format') format = 'csv',
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.products.exportCsv({ q, categoryId, status, sort });
    if (format !== 'csv') {
      // Future: xlsx / pdf — CSV for now
    }
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader(
      'Content-Disposition',
      'attachment; filename="products.csv"',
    );
    res!.send('\uFEFF' + csv);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkIdsDto) {
    return this.products.bulkDelete(dto.ids || []);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}
