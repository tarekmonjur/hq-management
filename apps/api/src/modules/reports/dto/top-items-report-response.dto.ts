import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopSellingItemDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: 'b1c2d3e4-0000-0000-0000-000000000001' })
  menuItemId: string;

  @ApiProperty({ example: 'Classic Beef Burger' })
  itemName: string;

  @ApiPropertyOptional({ example: 'Burgers' })
  category: string | null;

  @ApiProperty({ example: 'BURGER-01' })
  sku: string;

  @ApiProperty({ example: 250.0 })
  basePrice: number;

  @ApiProperty({ example: 340 })
  quantitySold: number;

  @ApiProperty({ example: 85000.0 })
  totalRevenue: number;
}

export class TopItemsOutletScopeDto {
  @ApiPropertyOptional({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  outletId: string | null;

  @ApiPropertyOptional({ example: 'Dhanmondi Branch' })
  outletName: string | null;
}

export class TopItemsReportDataDto {
  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z' })
  from: string | null;

  @ApiPropertyOptional({ example: '2026-11-07T23:59:59.999Z' })
  to: string | null;

  @ApiProperty({ type: TopItemsOutletScopeDto })
  scope: TopItemsOutletScopeDto;

  @ApiProperty({ example: 5 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalItemsCount: number;

  @ApiProperty({ type: [TopSellingItemDto] })
  items: TopSellingItemDto[];
}

export class TopItemsReportApiResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Top selling items report fetched successfully' })
  message: string;

  @ApiProperty({ type: TopItemsReportDataDto })
  data: TopItemsReportDataDto;
}

