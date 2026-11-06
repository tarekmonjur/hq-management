import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Outlet, User } from '../../database/entities/index.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutletsController } from './outlets.controller.js';
import { OutletsService } from './outlets.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Outlet, User]), AuthModule],
  controllers: [OutletsController],
  providers: [OutletsService],
})
export class OutletsModule {}
