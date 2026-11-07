import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Inventory,
  MenuItem,
  Outlet,
  OutletMenuItem,
  OutletReceiptCounter,
  Sale,
  SaleItem,
  User,
} from '../../database/entities/index.js';
import { AuthModule } from '../auth/auth.module.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      Inventory,
      OutletMenuItem,
      Outlet,
      OutletReceiptCounter,
      MenuItem,
      User,
    ]),
    AuthModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
