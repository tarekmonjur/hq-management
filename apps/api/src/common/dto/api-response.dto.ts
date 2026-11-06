import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseMetadataDto {
  @ApiProperty({ example: 'Fri, 06 Nov 2026 08:00:00 GMT' })
  timestamp: string;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'Service Unavailable' })
  message: string;

  @ApiPropertyOptional({ example: 503 })
  code?: number;

  @ApiPropertyOptional({ nullable: true, type: Object })
  extra?: unknown;
}

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ type: ApiResponseMetadataDto })
  metadata: ApiResponseMetadataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  data: T;

  @ApiProperty({ example: 'Request Success' })
  message: string;

  @ApiPropertyOptional({ type: ApiErrorBodyDto })
  error?: ApiErrorBodyDto;
}
