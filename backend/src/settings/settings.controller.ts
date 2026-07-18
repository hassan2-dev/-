import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('store')
  getStore() {
    return this.settings.getStore();
  }

  @Public()
  @Get('catalog-version')
  catalogVersion() {
    return this.settings.getCatalogVersion();
  }

  @Public()
  @Get('app-version')
  appVersion() {
    return this.settings.getAppVersionPolicy();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('store')
  updateStore(@Body() dto: UpdateSettingsDto) {
    return this.settings.updateStore(dto);
  }
}
