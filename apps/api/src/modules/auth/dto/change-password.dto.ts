import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ maxLength: 72, format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({ minLength: 12, maxLength: 72, format: 'password' })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  newPassword: string;
}
