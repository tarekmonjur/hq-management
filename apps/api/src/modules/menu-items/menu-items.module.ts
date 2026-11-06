import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MenuItem } from '../../database/entities/menu-item.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { MenuItemsController } from './menu-items.controller.js';
import { MenuItemsService } from './menu-items.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem]), AuthModule],
  controllers: [MenuItemsController],
  providers: [MenuItemsService],
})
export class MenuItemsModule {}
