import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDriverDto {
  @ApiProperty({ example: 'driver01' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  password!: string;

  @ApiProperty({ example: 'أحمد' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: '07801234567' })
  @IsString()
  phone!: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetDriverPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  password!: string;
}

export class AssignDriverDto {
  @ApiProperty()
  @IsString()
  driverId!: string;

  @ApiPropertyOptional({ description: 'Confirm reassignment if already assigned' })
  @IsOptional()
  @IsBoolean()
  confirmReassign?: boolean;
}

export class BulkIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
