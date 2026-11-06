import { ApiProperty } from '@nestjs/swagger';

import {
  ApiErrorBodyDto,
  ApiResponseDto,
  ApiResponseMetadataDto,
} from './api-response.dto.js';

export { ApiErrorBodyDto } from './api-response.dto.js';

export class ApiErrorMetadataDto extends ApiResponseMetadataDto {
  @ApiProperty({ example: '/api/v1/resource' })
  path: string;
}

export class ApiErrorResponseDto extends ApiResponseDto<null> {
  @ApiProperty({ type: ApiErrorMetadataDto })
  declare metadata: ApiErrorMetadataDto;

  @ApiProperty({ example: false })
  declare success: boolean;

  @ApiProperty({ type: ApiErrorBodyDto })
  declare error: ApiErrorBodyDto;

  @ApiProperty({ nullable: true, example: null })
  declare data: null;
}
