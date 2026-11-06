import { ApiProperty } from '@nestjs/swagger';

import { MenuItemUnit } from '../../../common/enums/menu-item.enum.js';
import { ApiResponseDto } from '../../../common/dto/api-response.dto.js';

export class MenuItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Chicken Burger', maxLength: 50 })
  name: string;

  @ApiProperty({
    example: 'Grilled chicken with fresh vegetables',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 250,
    nullable: true,
    minimum: 0,
    maximum: 99999999.99,
  })
  basePrice: number | null;

  @ApiProperty({ enum: MenuItemUnit, nullable: true })
  unit: MenuItemUnit | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class MenuItemListDataDto {
  @ApiProperty({ type: [MenuItemResponseDto] })
  items: MenuItemResponseDto[];

  @ApiProperty({ example: 42, minimum: 0 })
  total: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit: number;
}

export class MenuItemApiResponseDto extends ApiResponseDto<MenuItemResponseDto> {
  @ApiProperty({ type: MenuItemResponseDto })
  declare data: MenuItemResponseDto;
}

export class MenuItemListApiResponseDto extends ApiResponseDto<MenuItemListDataDto> {
  @ApiProperty({ type: MenuItemListDataDto })
  declare data: MenuItemListDataDto;
}

export class MenuItemDeleteDataDto {
  @ApiProperty({ example: 'Menu item deleted successfully' })
  message: string;
}

export class MenuItemDeleteApiResponseDto extends ApiResponseDto<MenuItemDeleteDataDto> {
  @ApiProperty({ type: MenuItemDeleteDataDto })
  declare data: MenuItemDeleteDataDto;
}
