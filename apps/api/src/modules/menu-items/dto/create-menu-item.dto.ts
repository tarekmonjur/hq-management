import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { MenuItemUnit } from '../../../common/enums/menu-item.enum.js';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseNullableNumber(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return Number.NaN;
}

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Chicken Burger', minLength: 1, maxLength: 50 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    example: 'Grilled chicken with fresh vegetables',
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    example: 250,
    minimum: 0,
    maximum: 99999999.99,
    multipleOf: 0.01,
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) => parseNullableNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  basePrice?: number | null;

  @ApiPropertyOptional({
    enum: MenuItemUnit,
    example: MenuItemUnit.PIECE,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(MenuItemUnit)
  unit?: MenuItemUnit | null;
}
