import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  ApiErrorMetadataDto,
  ApiErrorResponseDto,
} from '../../../common/dto/api-error-response.dto.js';
import { ApiResponseDto } from '../../../common/dto/api-response.dto.js';

export class HealthIndicatorDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status: 'up' | 'down';
}

export class HealthIndicatorsDto {
  @ApiPropertyOptional({ type: HealthIndicatorDto })
  database?: HealthIndicatorDto;

  @ApiPropertyOptional({ type: HealthIndicatorDto })
  storage?: HealthIndicatorDto;
}

export class HealthCheckDataDto {
  @ApiProperty({
    enum: ['ok', 'error', 'shutting_down'],
    example: 'ok',
  })
  status: 'ok' | 'error' | 'shutting_down';

  @ApiProperty({ type: HealthIndicatorsDto })
  info: HealthIndicatorsDto;

  @ApiProperty({
    type: HealthIndicatorsDto,
    example: {},
  })
  error: HealthIndicatorsDto;

  @ApiProperty({ type: HealthIndicatorsDto })
  details: HealthIndicatorsDto;
}

export class HealthApiResponseDto extends ApiResponseDto<HealthCheckDataDto> {
  @ApiProperty({ type: HealthCheckDataDto })
  declare data: HealthCheckDataDto;
}

export class HealthErrorMetadataDto extends ApiErrorMetadataDto {
  @ApiProperty({ example: '/api/v1/health' })
  declare path: string;
}

export class HealthApiErrorResponseDto extends ApiErrorResponseDto {
  @ApiProperty({ type: HealthErrorMetadataDto })
  declare metadata: HealthErrorMetadataDto;

  @ApiProperty({ example: 503 })
  declare statusCode: number;

  @ApiProperty({ example: 'SERVICE UNAVAILABLE' })
  declare message: string;
}
