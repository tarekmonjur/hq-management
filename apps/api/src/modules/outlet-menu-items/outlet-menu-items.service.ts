import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { UserRole } from '../../common/enums/user.enum.js';
import { hasConstraint } from '../../common/utils/postgres-error.util.js';
import {
  Inventory,
  MenuItem,
  Outlet,
  OutletMenuItem,
  User,
} from '../../database/entities/index.js';
import { CreateOutletMenuItemDto } from './dto/create-outlet-menu-item.dto.js';
import { ListOutletMenuItemsQueryDto } from './dto/list-outlet-menu-items-query.dto.js';
import { UpdateOutletMenuItemPriceDto } from './dto/update-outlet-menu-item-price.dto.js';

export interface OutletMenuItemView {
  id: string;
  outletId: string;
  outletName: string;
  menuItemId: string;
  menuItemName: string;
  outletPrice: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OutletMenuItemsService {
  constructor(
    @InjectRepository(OutletMenuItem)
    private readonly outletMenuItemRepository: Repository<OutletMenuItem>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    userId: string,
    dto: CreateOutletMenuItemDto,
  ): Promise<OutletMenuItemView> {
    const companyId = await this.requireCompanyId(userId);
    const outlet = await this.findCompanyOutlet(companyId, dto.outletId);
    const menuItem = await this.menuItemRepository.findOneBy({
      id: dto.menuItemId,
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    const assignment = this.outletMenuItemRepository.create({
      outletId: dto.outletId,
      menuItemId: dto.menuItemId,
      outletPrice: dto.outletPrice ?? null,
      isActive: dto.isActive ?? false,
    });

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const savedAssignment = await manager.save(OutletMenuItem, assignment);

        const existingInventory = await manager.findOne(Inventory, {
          where: {
            outletId: dto.outletId,
            menuItemId: dto.menuItemId,
          },
        });

        if (!existingInventory) {
          const inventory = manager.create(Inventory, {
            outletId: dto.outletId,
            menuItemId: dto.menuItemId,
            quantity: 0,
          });
          await manager.save(Inventory, inventory);
        }

        return savedAssignment;
      });

      return this.toView(saved, menuItem.name, outlet.name);
    } catch (error) {
      this.throwKnownConstraintError(error);
      throw error;
    }
  }

  async findAll(userId: string, query: ListOutletMenuItemsQueryDto) {
    const access = await this.requireListAccess(userId);
    const outletId =
      access.role === UserRole.SUPER_ADMIN
        ? query.outletId
        : this.scopedOutletId(
            { role: access.role, outletId: access.outletId },
            query.outletId,
          );
    const queryBuilder = this.outletMenuItemRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.menuItem', 'menuItem')
      .innerJoinAndSelect('assignment.outlet', 'outlet');

    if (access.role !== UserRole.SUPER_ADMIN) {
      queryBuilder.where('outlet.companyId = :companyId', {
        companyId: access.companyId,
      });
    }

    if (outletId) {
      queryBuilder.andWhere('assignment.outletId = :outletId', { outletId });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('assignment.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.search) {
      queryBuilder.andWhere('menuItem.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    const [assignments, total] = await queryBuilder
      .orderBy('menuItem.name', 'ASC')
      .addOrderBy('assignment.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: assignments.map((assignment) =>
        this.toView(
          assignment,
          assignment.menuItem.name,
          assignment.outlet.name,
        ),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async updatePrice(
    userId: string,
    menuItemId: string,
    dto: UpdateOutletMenuItemPriceDto,
  ): Promise<OutletMenuItemView> {
    const companyId = await this.requireCompanyId(userId);
    const outlet = await this.findCompanyOutlet(companyId, dto.outletId);
    const assignment = await this.findAssignment(dto.outletId, menuItemId);

    assignment.outletPrice = dto.outletPrice;

    try {
      const saved = await this.outletMenuItemRepository.save(assignment);
      return this.toView(saved, assignment.menuItem.name, outlet.name);
    } catch (error) {
      this.throwKnownConstraintError(error);
      throw error;
    }
  }

  async remove(
    userId: string,
    menuItemId: string,
    outletId: string,
  ): Promise<{ message: string }> {
    const companyId = await this.requireCompanyId(userId);
    await this.findCompanyOutlet(companyId, outletId);
    const assignment = await this.findAssignment(outletId, menuItemId);

    await this.outletMenuItemRepository.remove(assignment);

    return { message: 'Outlet menu assignment removed successfully' };
  }

  private async requireCompanyId(userId: string): Promise<string> {
    return (await this.requireAccess(userId)).companyId;
  }

  private async requireListAccess(userId: string): Promise<{
    companyId: string | null;
    role: UserRole;
    outletId: string | null;
  }> {
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
      throw new ForbiddenException('Outlet menu access is not available');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return {
        companyId: user.companyId ?? null,
        role: user.role,
        outletId: user.outletId ?? null,
      };
    }

    if (!user.companyId) {
      throw new ForbiddenException('Outlet menu access is not available');
    }

    return {
      companyId: user.companyId,
      role: user.role,
      outletId: user.outletId ?? null,
    };
  }

  private async requireAccess(userId: string): Promise<{
    companyId: string;
    role: UserRole;
    outletId: string | null;
  }> {
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

    if (!user?.isActive || !user.companyId) {
      throw new ForbiddenException('Outlet menu access is not available');
    }

    return {
      companyId: user.companyId,
      role: user.role,
      outletId: user.outletId ?? null,
    };
  }

  private scopedOutletId(
    access: { role: UserRole; outletId: string | null },
    requestedOutletId?: string,
  ): string | undefined {
    if (
      access.role === UserRole.HQ_ADMIN ||
      access.role === UserRole.SUPER_ADMIN
    ) {
      return requestedOutletId;
    }

    if (!access.outletId) {
      throw new ForbiddenException('Outlet menu access is not available');
    }

    return access.outletId;
  }

  private async findCompanyOutlet(
    companyId: string,
    outletId: string,
  ): Promise<Outlet> {
    const outlet = await this.outletRepository.findOne({
      where: { id: outletId, companyId },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    return outlet;
  }

  private async findAssignment(
    outletId: string,
    menuItemId: string,
  ): Promise<OutletMenuItem> {
    const assignment = await this.outletMenuItemRepository.findOne({
      where: { outletId, menuItemId },
      relations: { menuItem: true },
    });

    if (!assignment) {
      throw new NotFoundException('Outlet menu assignment not found');
    }

    return assignment;
  }

  private toView(
    assignment: OutletMenuItem,
    menuItemName: string,
    outletName: string,
  ): OutletMenuItemView {
    return {
      id: assignment.id,
      outletId: assignment.outletId,
      outletName,
      menuItemId: assignment.menuItemId,
      menuItemName,
      outletPrice: assignment.outletPrice ?? null,
      isActive: assignment.isActive,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private throwKnownConstraintError(error: unknown): void {
    if (hasConstraint(error, '23505', 'uq_outlet_menu_items_outlet_item')) {
      throw new ConflictException(
        'This menu item is already assigned to the outlet',
      );
    }

    if (hasConstraint(error, '23514', 'chk_outlet_menu_items_outlet_price')) {
      throw new BadRequestException('Outlet price must be zero or greater');
    }
  }
}
