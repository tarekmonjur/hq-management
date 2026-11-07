import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OutletRevenueItemDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000001' })
  outletId: string;

  @ApiProperty({ example: 'Dhanmondi Branch' })
  outletName: string;

  @ApiProperty({ example: 'Dhanmondi, Dhaka' })
  outletLocation: string | null;

  @ApiProperty({ example: 45000.5 })
  totalRevenue: number;

  @ApiProperty({ example: 120 })
  totalSalesCount: number;

  @ApiProperty({ example: 375.0 })
  averageOrderValue: number;
}

export class RevenueReportSummaryDto {
  @ApiProperty({ example: 95000.5 })
  totalRevenue: number;

  @ApiProperty({ example: 250 })
  totalSalesCount: number;

  @ApiProperty({ example: 2 })
  outletCount: number;
}

export class RevenueReportDataDto {
  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z' })
  from: string | null;

  @ApiPropertyOptional({ example: '2026-11-07T23:59:59.999Z' })
  to: string | null;

  @ApiProperty({ type: RevenueReportSummaryDto })
  summary: RevenueReportSummaryDto;

  @ApiProperty({ type: [OutletRevenueItemDto] })
  outlets: OutletRevenueItemDto[];
}

export class RevenueReportApiResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Revenue report fetched successfully' })
  message: string;

  @ApiProperty({ type: RevenueReportDataDto })
  data: RevenueReportDataDto;
}
