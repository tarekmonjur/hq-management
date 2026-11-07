import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseMetadataDto {
  @ApiProperty({ example: 'Fri, 06 Nov 2026 08:00:00 GMT' })
  timestamp: string;
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

  @ApiPropertyOptional({
    nullable: true,
    example: null,
    type: Object,
  })
  error?: null;
}
