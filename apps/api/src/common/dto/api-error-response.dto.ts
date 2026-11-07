import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

import {
  ApiResponseMetadataDto,
} from './api-response.dto.js';

export class ApiErrorMetadataDto extends ApiResponseMetadataDto {
  @ApiProperty({ example: '/api/v1/resource' })
  path: string;
}

export class ApiErrorBodyDto {
  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Error Message...' },
      {
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: { type: 'string' },
        },
        example: {
          email: ['must be an email'],
          password: ['must be longer than or equal to 12 characters'],
        },
      },
    ],
  })
  message: string | Record<string, string[]>;

  @ApiProperty({ example: 500 })
  code?: number;

  @ApiPropertyOptional({ nullable: true, type: Object })
  extra?: unknown;
}

export class ApiErrorResponseCommonDto<T = unknown> {
  @ApiProperty({ type: ApiErrorMetadataDto })
  metadata: ApiErrorMetadataDto;
  
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: ApiErrorBodyDto })
  error: ApiErrorBodyDto;

  @ApiProperty({ nullable: true, example: null })
  data: T;
}

export class ApiErrorResponseDto extends ApiErrorResponseCommonDto<null> {
  @ApiProperty({ example: HttpStatus.INTERNAL_SERVER_ERROR })
  statusCode: number;

  @ApiProperty({ example: 'Internal Server Error' })
  message: string;
}

export class ApiBadRequestResponse extends ApiErrorResponseCommonDto<null> {
  @ApiProperty({ example: HttpStatus.BAD_REQUEST })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  message: string;

}

export class ApiUnauthorizedResponse extends ApiErrorResponseCommonDto<null> {
  @ApiProperty({ example: HttpStatus.UNAUTHORIZED })
  statusCode: number;

  @ApiProperty({ example: 'Unauthorized' })
  message: string;
}

export class ApiForbiddenResponse extends ApiErrorResponseCommonDto<null> {
  @ApiProperty({ example: HttpStatus.FORBIDDEN })
  statusCode: number;

  @ApiProperty({ example: 'Forbidden' })
  message: string;
}

export class ApiNotFoundResponse extends ApiErrorResponseCommonDto<null> {
  @ApiProperty({ example: HttpStatus.NOT_FOUND })
  statusCode: number;

  @ApiProperty({ example: 'Not Found' })
  message: string;
}

export class ApiTooManyRequestsResponse extends ApiErrorResponseCommonDto<null> {
  @ApiProperty({ example: HttpStatus.TOO_MANY_REQUESTS })
  statusCode: number;

  @ApiProperty({ example: 'Too Many Requests' })
  message: string;
}

export class ApiConflictResponse extends ApiErrorResponseCommonDto<null> {
  @ApiProperty({ example: HttpStatus.CONFLICT })
  statusCode: number;

  @ApiProperty({ example: 'Conflict' })
  message: string;
}