import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Inventory,
  MenuItem,
  Outlet,
  User,
} from '../../database/entities/index.js';
import { AuthModule } from '../auth/auth.module.js';
import { InventoriesController } from './inventories.controller.js';
import { InventoriesService } from './inventories.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inventory, Outlet, MenuItem, User]),
    AuthModule,
  ],
  controllers: [InventoriesController],
  providers: [InventoriesService],
  exports: [InventoriesService],
})
export class InventoriesModule {}

