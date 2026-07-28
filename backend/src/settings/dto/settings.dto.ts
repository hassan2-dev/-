import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  closeTime?: string;

  @ApiPropertyOptional({ example: 'Asia/Baghdad' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Force users below min version to update' })
  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @ApiPropertyOptional({ example: '1.0.3' })
  @IsOptional()
  @IsString()
  minIosVersion?: string | null;

  @ApiPropertyOptional({ example: '1.0.3' })
  @IsOptional()
  @IsString()
  minAndroidVersion?: string | null;

  @ApiPropertyOptional({ example: 'يتوفر تحديث مهم. حدّث التطبيق للمتابعة.' })
  @IsOptional()
  @IsString()
  updateMessage?: string | null;

  @ApiPropertyOptional({
    example:
      'https://apps.apple.com/us/app/%D9%85%D8%AA%D8%AC%D8%B1-%D8%AA%D9%81%D8%A7%D8%AD%D8%A9/id6763769377',
  })
  @IsOptional()
  @IsString()
  iosStoreUrl?: string | null;

  @ApiPropertyOptional({
    example: 'https://play.google.com/store/apps/details?id=com.tofahastore.app',
  })
  @IsOptional()
  @IsString()
  androidStoreUrl?: string | null;
}
