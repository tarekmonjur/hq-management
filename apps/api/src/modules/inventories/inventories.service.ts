import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { hasConstraint } from '../../common/utils/postgres-error.util.js';
import { UserRole } from '../../common/enums/user.enum.js';
import {
  Inventory,
  MenuItem,
  Outlet,
  User,
} from '../../database/entities/index.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import { ListInventoriesQueryDto } from './dto/list-inventories-query.dto.js';
import { InventoryResponseDto } from './dto/inventory-response.dto.js';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HQ_ADMIN];

@Injectable()
export class InventoriesService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(
    userId: string,
    query: ListInventoriesQueryDto,
  ): Promise<{
    items: InventoryResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const user = await this.loadActiveUser(userId);

    const isAdmin = ADMIN_ROLES.includes(user.role);

    const queryBuilder = this.inventoryRepository
      .createQueryBuilder('inventory')
      .innerJoinAndSelect('inventory.menuItem', 'menuItem')
      .innerJoinAndSelect('inventory.outlet', 'outlet');

    if (isAdmin) {
      // Scope to all outlets of the admin's company
      queryBuilder.where('outlet.companyId = :companyId', {
        companyId: user.companyId,
      });

      // Admin-only optional filters
      if (query.outletId) {
        queryBuilder.andWhere('inventory.outletId = :outletId', {
          outletId: query.outletId,
        });
      }
    } else {
      // Outlet role — scope to their assigned outlet only
      if (!user.outletId) {
        throw new ForbiddenException('No outlet assigned to this user');
      }
      queryBuilder.where('inventory.outletId = :outletId', {
        outletId: user.outletId,
      });
    }

    if (query.search) {
      queryBuilder.andWhere('menuItem.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [inventories, total] = await queryBuilder
      .orderBy('menuItem.name', 'ASC')
      .addOrderBy('inventory.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: inventories.map((inv) => this.toResponseDto(inv)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async adjustStock(
    userId: string,
    inventoryId: string,
    dto: AdjustInventoryDto,
  ): Promise<InventoryResponseDto> {
    const user = await this.loadActiveUser(userId);

    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions to adjust stock');
    }

    const inventory = await this.inventoryRepository.findOne({
      where: { id: inventoryId },
      relations: { menuItem: true, outlet: true },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found');
    }

    // Ensure the inventory belongs to the admin's company
    if (inventory.outlet.companyId !== user.companyId) {
      throw new ForbiddenException(
        'Inventory record does not belong to your company',
      );
    }

    inventory.quantity = dto.quantity;

    try {
      const saved = await this.inventoryRepository.save(inventory);
      return this.toResponseDto(saved);
    } catch (error) {
      if (
        hasConstraint(error, '23514', 'chk_inventories_quantity_non_negative')
      ) {
        throw new BadRequestException('Quantity must be zero or greater');
      }
      throw error;
    }
  }

  private async loadActiveUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        companyId: true,
        outletId: true,
        isActive: true,
      },
    });

    if (!user?.isActive) {
      throw new ForbiddenException('Inventory access is not available');
    }

    return user;
  }

  private toResponseDto(inventory: Inventory): InventoryResponseDto {
    return {
      id: inventory.id,
      outletId: inventory.outletId,
      outletName: inventory.outlet.name,
      outletCode: inventory.outlet.code,
      menuItemId: inventory.menuItemId,
      menuItemName: inventory.menuItem.name,
      menuItemUnit: inventory.menuItem.unit,
      quantity: inventory.quantity,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    };
  }
}

