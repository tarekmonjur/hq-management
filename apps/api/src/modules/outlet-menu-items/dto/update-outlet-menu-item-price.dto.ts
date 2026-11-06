import { Transform } from 'class-transformer';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

function parseNumber(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return Number.NaN;
}

export class UpdateOutletMenuItemPriceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  outletId: string;

  @ApiProperty({
    example: 275.5,
    minimum: 0,
    maximum: 99999999.99,
    multipleOf: 0.01,
  })
  @Transform(({ value }: { value: unknown }) => parseNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  outletPrice: number;
}
