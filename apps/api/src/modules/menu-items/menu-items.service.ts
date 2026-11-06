import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import {
  getPostgresDriverError,
  hasConstraint,
} from '../../common/utils/postgres-error.util.js';
import { MenuItem } from '../../database/entities/menu-item.entity.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto.js';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto.js';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
  ) {}

  async create(dto: CreateMenuItemDto): Promise<MenuItem> {
    const menuItem = this.menuItemRepository.create(dto);

    try {
      return await this.menuItemRepository.save(menuItem);
    } catch (error) {
      this.throwKnownConstraintError(error);
      throw error;
    }
  }

  async findAll(query: ListMenuItemsQueryDto) {
    const where = query.search
      ? { name: ILike(`%${query.search}%`) }
      : undefined;
    const [items, total] = await this.menuItemRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string): Promise<MenuItem> {
    const menuItem = await this.menuItemRepository.findOneBy({ id });
    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    return menuItem;
  }

  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const menuItem = await this.findOne(id);
    Object.assign(menuItem, dto);

    try {
      return await this.menuItemRepository.save(menuItem);
    } catch (error) {
      this.throwKnownConstraintError(error);
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const menuItem = await this.findOne(id);

    try {
      await this.menuItemRepository.remove(menuItem);
    } catch (error) {
      const driverError = getPostgresDriverError(error);
      if (driverError?.code === '23503') {
        throw new ConflictException(
          'Menu item is referenced by other records and cannot be deleted',
        );
      }

      throw error;
    }

    return { message: 'Menu item deleted successfully' };
  }

  private throwKnownConstraintError(error: unknown): void {
    if (hasConstraint(error, '23505', 'uq_menu_items_name')) {
      throw new ConflictException('A menu item with this name already exists');
    }

    if (hasConstraint(error, '23514', 'chk_menu_items_base_price')) {
      throw new BadRequestException('Base price must be zero or greater');
    }
  }
}
