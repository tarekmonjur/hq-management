import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { OrderStatus, PaymentStatus } from '../../../common/enums/sale.enum.js';

function trimString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

@ValidatorConstraint({ name: 'saleDateRange', async: false })
class SaleDateRangeConstraint implements ValidatorConstraintInterface {
  validate(to: unknown, args: ValidationArguments): boolean {
    const from = (args.object as ListSalesQueryDto).from;
    if (typeof from !== 'string' || typeof to !== 'string') {
      return true;
    }

    return new Date(from).getTime() <= new Date(to).getTime();
  }

  defaultMessage(): string {
    return 'from must be earlier than or equal to to';
  }
}

export class ListSalesQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    example: '12',
    minLength: 1,
    maxLength: 50,
    description:
      'Numeric values match receipt number. Any other value searches table number.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  search?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'HQ_ADMIN and SUPER_ADMIN only. Outlet roles are always limited to their own outlet.',
  })
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'SUPER_ADMIN only. Filters sales to one company.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ example: 'T12', maxLength: 20 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(20)
  tableNo?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inclusive lower bound on createdAt',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inclusive upper bound on createdAt',
  })
  @IsOptional()
  @IsDateString()
  @Validate(SaleDateRangeConstraint)
  to?: string;
}
