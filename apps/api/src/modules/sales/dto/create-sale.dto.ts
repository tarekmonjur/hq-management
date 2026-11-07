import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  registerDecorator,
  ValidateNested,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OrderStatus, PaymentStatus } from '../../../common/enums/sale.enum.js';

function UniqueMenuItemIds(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'uniqueMenuItemIds',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!Array.isArray(value)) {
            return true;
          }

          const ids = value.map(
            (item: { menuItemId?: unknown }) => item?.menuItemId,
          );
          return new Set(ids).size === ids.length;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must not contain duplicate menu items`;
        },
      },
    });
  };
}

export class CreateSaleItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  menuItemId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for HQ_ADMIN and SUPER_ADMIN. Outlet staff may omit it; a different outlet is rejected.',
  })
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @ApiPropertyOptional({ example: 'T12', maxLength: 20, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tableNo?: string;

  @ApiPropertyOptional({ enum: OrderStatus, default: OrderStatus.SERVED })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.PAID })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiProperty({ type: [CreateSaleItemDto], minItems: 1, maxItems: 50 })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @UniqueMenuItemIds()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}
