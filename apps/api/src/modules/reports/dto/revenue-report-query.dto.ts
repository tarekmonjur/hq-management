import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class RevenueReportQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by specific outlet ID',
  })
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @ApiPropertyOptional({
    example: '2026-11-01T00:00:00.000Z',
    description: 'Start date-time (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-07T23:59:59.999Z',
    description: 'End date-time (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

