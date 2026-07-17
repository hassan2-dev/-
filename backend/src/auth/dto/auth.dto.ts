import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '07801234567' })
  @IsString()
  @Matches(/^(\+?964|0)?7[3-9]\d{8}$/, {
    message: 'رقم هاتف عراقي غير صالح',
  })
  phone!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '07801234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(4)
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
