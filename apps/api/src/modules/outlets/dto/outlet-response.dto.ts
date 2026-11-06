import { ApiProperty } from '@nestjs/swagger';

import { ApiResponseDto } from '../../../common/dto/api-response.dto.js';

export class OutletResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ example: 'OUT-001', maxLength: 20 })
  code: string;

  @ApiProperty({ example: 'Downtown Branch', maxLength: 255 })
  name: string;

  @ApiProperty({ example: 'Downtown', maxLength: 255, nullable: true })
  location: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time', nullable: true })
  updatedAt: Date | null;
}

export class OutletListDataDto {
  @ApiProperty({ type: [OutletResponseDto] })
  items: OutletResponseDto[];

  @ApiProperty({ example: 42, minimum: 0 })
  total: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit: number;
}

export class OutletListApiResponseDto extends ApiResponseDto<OutletListDataDto> {
  @ApiProperty({ type: OutletListDataDto })
  declare data: OutletListDataDto;
}
