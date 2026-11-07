import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OrderStatus, PaymentStatus } from '../../../common/enums/sale.enum.js';
import { ApiResponseDto } from '../../../common/dto/api-response.dto.js';

export class SaleItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  menuItemId: string;

  @ApiProperty({ example: 'Classic Burger' })
  menuItemName: string;

  @ApiProperty({ example: 2, minimum: 1 })
  quantity: number;

  @ApiProperty({ example: 8.5, minimum: 0 })
  unitPrice: number;

  @ApiProperty({ example: 17, minimum: 0 })
  lineTotal: number;
}

export class SaleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  outletId: string;

  @ApiProperty({ example: 'Downtown Branch' })
  outletName: string;

  @ApiProperty({ example: 'OUT-001', maxLength: 20 })
  outletCode: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ example: 12, minimum: 1 })
  receiptNo: number;

  @ApiProperty({ example: 17, minimum: 0 })
  total: number;

  @ApiPropertyOptional({ example: 'T12', maxLength: 20, nullable: true })
  tableNo: string | null;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.SERVED })
  orderStatus: OrderStatus;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PAID })
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({
    example: 'pos-device-0001',
    maxLength: 64,
    nullable: true,
  })
  idempotencyKey: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: [SaleItemResponseDto] })
  items: SaleItemResponseDto[];
}

export class SaleListDataDto {
  @ApiProperty({ type: [SaleResponseDto] })
  items: SaleResponseDto[];

  @ApiProperty({ example: 42, minimum: 0 })
  total: number;

  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit: number;
}

export class SaleApiResponseDto extends ApiResponseDto<SaleResponseDto> {
  @ApiProperty({ type: SaleResponseDto })
  declare data: SaleResponseDto;
}

export class SaleListApiResponseDto extends ApiResponseDto<SaleListDataDto> {
  @ApiProperty({ type: SaleListDataDto })
  declare data: SaleListDataDto;
}
