import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsIn,
  IsUUID,
} from 'class-validator';
import { UserRole } from '../../../common/enums/user.enum.js';

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

  @ApiProperty({ example: UserRole.HQ_ADMIN, enum: UserRole })
  @IsOptional()
  @IsString()
  @IsIn([UserRole.HQ_ADMIN, UserRole.OUTLET_MANAGER, UserRole.OUTLET_STAFF])
  role?: UserRole;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsString()
  @IsUUID()
  outletId?: string;

  @ApiPropertyOptional({ example: '+8801700000000', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNo?: string;
}
