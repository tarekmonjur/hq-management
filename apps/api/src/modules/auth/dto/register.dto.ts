import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 255, format: 'email' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 12, maxLength: 72, format: 'password' })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Ada Lovelace', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ example: '+8801700000000', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNo?: string;
}
