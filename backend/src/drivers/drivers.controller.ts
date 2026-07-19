import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { DriversService } from './drivers.service';
import {
  CreateDriverDto,
  ResetDriverPasswordDto,
  UpdateDriverDto,
} from './dto/driver.dto';

@ApiTags('drivers')
@ApiBearerAuth()
@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Roles(Role.ADMIN)
  @Get()
  list() {
    return this.drivers.list();
  }

  @Roles(Role.ADMIN)
  @Get('stats')
  stats() {
    return this.drivers.stats();
  }

  @Roles(Role.DRIVER)
  @Get('me/today-stats')
  myTodayStats(@CurrentUser() user: AuthUser) {
    return this.drivers.driverTodayStats(user.id);
  }

  @Roles(Role.ADMIN)
  @Get(':id/orders')
  orders(@Param('id') id: string) {
    return this.drivers.findOrders(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateDriverDto) {
    return this.drivers.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.drivers.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetDriverPasswordDto) {
    return this.drivers.resetPassword(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.drivers.remove(id);
  }
}
