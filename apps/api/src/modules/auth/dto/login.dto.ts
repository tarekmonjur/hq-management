import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72, format: 'password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ example: 'device-1', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'Office laptop', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;

  @ApiPropertyOptional({ example: 'mobile', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;
}
