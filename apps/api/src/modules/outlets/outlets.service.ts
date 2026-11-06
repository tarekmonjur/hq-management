import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';

import { UserRole } from '../../common/enums/user.enum.js';
import { Outlet, User } from '../../database/entities/index.js';
import { ListOutletsQueryDto } from './dto/list-outlets-query.dto.js';

@Injectable()
export class OutletsService {
  constructor(
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findCompanyOutlets(
    userId: string,
    query: ListOutletsQueryDto,
  ): Promise<{
    items: Outlet[];
    total: number;
    page: number;
    limit: number;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        companyId: true,
        isActive: true,
      },
    });

    if (!user?.isActive || !user.companyId) {
      throw new ForbiddenException('Outlet access is not available');
    }

    const queryBuilder = this.outletRepository
      .createQueryBuilder('outlet')
      .where('outlet.companyId = :companyId', { companyId: user.companyId });

    this.applyFilters(queryBuilder, query);

    const [items, total] = await queryBuilder
      .orderBy('outlet.name', 'ASC')
      .addOrderBy('outlet.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Outlet>,
    query: ListOutletsQueryDto,
  ): void {
    if (query.code) {
      queryBuilder.andWhere('outlet.code = :code', { code: query.code });
    }

    if (query.location) {
      queryBuilder.andWhere('outlet.location = :location', {
        location: query.location,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        new Brackets((searchBuilder) => {
          searchBuilder
            .where('outlet.name ILIKE :search')
            .orWhere('outlet.code ILIKE :search')
            .orWhere('outlet.location ILIKE :search');
        }),
        { search: `%${query.search}%` },
      );
    }
  }
}
