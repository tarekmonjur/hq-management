import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class TopItemsReportQueryDto {
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

  @ApiPropertyOptional({
    default: 5,
    minimum: 1,
    maximum: 50,
    description: 'Number of top items to return (defaults to 5)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 5;
}

