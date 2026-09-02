import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { AssignDriverDto } from '../drivers/dto/driver.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.findMine(user);
  }

  @Roles(Role.DRIVER)
  @Get('mine-driver')
  mineDriver(@CurrentUser() user: AuthUser) {
    return this.orders.findMineDriver(user);
  }

  @Roles(Role.ADMIN)
  @Get()
  findAll(@Query('status') status?: OrderStatus) {
    return this.orders.findAll(status);
  }

  @Roles(Role.ADMIN)
  @Post('reset-sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset active sales',
    description:
      'Deletes accepted, preparing, and on-the-way orders so the sales total resets.',
  })
  resetSales(@CurrentUser() user: AuthUser) {
    return this.orders.resetSales(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an order' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.remove(id, user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AssignDriverDto,
  ) {
    return this.orders.assignDriver(id, user, dto);
  }

  @Roles(Role.ADMIN, Role.DRIVER)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, user, dto);
  }
}
