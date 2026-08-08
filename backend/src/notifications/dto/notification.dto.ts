import { IsBoolean, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BroadcastDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional({ description: 'Extra Expo push data (string values)' })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}

export class RegisterPushTokenDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

export class MarkReadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}
