import { ApiProperty } from '@nestjs/swagger';

import { MenuItemUnit } from '../../../common/enums/menu-item.enum.js';
import { ApiResponseDto } from '../../../common/dto/api-response.dto.js';

export class InventoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  outletId: string;

  @ApiProperty({ example: 'Downtown Branch' })
  outletName: string;

  @ApiProperty({ example: 'OUT-001', maxLength: 20 })
  outletCode: string;

  @ApiProperty({ format: 'uuid' })
  menuItemId: string;

  @ApiProperty({ example: 'Chicken Burger' })
  menuItemName: string;

  @ApiProperty({ enum: MenuItemUnit, nullable: true })
  menuItemUnit: MenuItemUnit | null;

  @ApiProperty({ example: 50, minimum: 0 })
  quantity: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class InventoryListDataDto {
  @ApiProperty({ type: [InventoryResponseDto] })
  items: InventoryResponseDto[];

  @ApiProperty({ example: 42, minimum: 0 })
  total: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit: number;
}

export class InventoryApiResponseDto extends ApiResponseDto<InventoryResponseDto> {
  @ApiProperty({ type: InventoryResponseDto })
  declare data: InventoryResponseDto;
}

export class InventoryListApiResponseDto extends ApiResponseDto<InventoryListDataDto> {
  @ApiProperty({ type: InventoryListDataDto })
  declare data: InventoryListDataDto;
}

