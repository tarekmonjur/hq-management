import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustInventoryDto {
  @ApiProperty({
    example: 50,
    minimum: 0,
    description: 'Absolute stock quantity to set for this inventory record',
  })
  @IsInt()
  @Min(0)
  quantity: number;
}

