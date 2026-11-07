import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Inventory,
  MenuItem,
  Outlet,
  OutletMenuItem,
  User,
} from '../../database/entities/index.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutletMenuItemsController } from './outlet-menu-items.controller.js';
import { OutletMenuItemsService } from './outlet-menu-items.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutletMenuItem,
      Outlet,
      MenuItem,
      User,
      Inventory,
    ]),
    AuthModule,
  ],
  controllers: [OutletMenuItemsController],
  providers: [OutletMenuItemsService],
})
export class OutletMenuItemsModule {}
