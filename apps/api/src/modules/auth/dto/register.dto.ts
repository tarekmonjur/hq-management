import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNo?: string;
}

