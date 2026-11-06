import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ListOutletsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    example: 'downtown',
    minLength: 1,
    maxLength: 255,
    description:
      'Case-insensitive search across outlet name, code, and location',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    example: 'OUT-001',
    minLength: 1,
    maxLength: 20,
    description: 'Exact outlet code filter',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({
    example: 'Downtown',
    minLength: 1,
    maxLength: 255,
    description: 'Exact outlet location filter',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  location?: string;
}
