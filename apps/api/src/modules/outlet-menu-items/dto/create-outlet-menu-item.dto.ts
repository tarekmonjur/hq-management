import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class CreateOutletMenuItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  outletId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  menuItemId: string;

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
  outletPrice?: number | null;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
