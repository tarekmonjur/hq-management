import { ApiProperty } from '@nestjs/swagger';

import { ApiResponseDto } from '../../../common/dto/api-response.dto.js';

export class OutletMenuItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  outletId: string;

  @ApiProperty({ example: 'Downtown Branch' })
  outletName: string;

  @ApiProperty({ format: 'uuid' })
  menuItemId: string;

  @ApiProperty({ example: 'Chicken Burger' })
  menuItemName: string;

  @ApiProperty({
    example: 250,
    nullable: true,
    minimum: 0,
    maximum: 99999999.99,
  })
  outletPrice: number | null;

  @ApiProperty({ example: false })
  isActive: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class OutletMenuItemListDataDto {
  @ApiProperty({ type: [OutletMenuItemResponseDto] })
  items: OutletMenuItemResponseDto[];

  @ApiProperty({ example: 42, minimum: 0 })
  total: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit: number;
}

export class OutletMenuItemApiResponseDto extends ApiResponseDto<OutletMenuItemResponseDto> {
  @ApiProperty({ type: OutletMenuItemResponseDto })
  declare data: OutletMenuItemResponseDto;
}

export class OutletMenuItemListApiResponseDto extends ApiResponseDto<OutletMenuItemListDataDto> {
  @ApiProperty({ type: OutletMenuItemListDataDto })
  declare data: OutletMenuItemListDataDto;
}

export class OutletMenuItemDeleteDataDto {
  @ApiProperty({ example: 'Outlet menu assignment removed successfully' })
  message: string;
}

export class OutletMenuItemDeleteApiResponseDto extends ApiResponseDto<OutletMenuItemDeleteDataDto> {
  @ApiProperty({ type: OutletMenuItemDeleteDataDto })
  declare data: OutletMenuItemDeleteDataDto;
}
