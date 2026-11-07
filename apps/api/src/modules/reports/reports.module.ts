import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { MenuItem } from '../../database/entities/menu-item.entity.js';
import { Outlet } from '../../database/entities/outlet.entity.js';
import { SaleItem } from '../../database/entities/sale-item.entity.js';
import { Sale } from '../../database/entities/sale.entity.js';
import { User } from '../../database/entities/user.entity.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Outlet, MenuItem, User]),
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

