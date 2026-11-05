// src/database/entities/outlet.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  DeleteDateColumn,
  UpdateDateColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Company } from './company.entity.js';
import { OutletMenuItem } from './outlet-menu-item.entity.js';
import { Inventory } from './inventory.entity.js';
import { Sale } from './sale.entity';

@Entity('outlets')
@Index('idx_outlets_company', ['companyId'])
@Index('idx_outlets_code', ['code'])
@Index('idx_outlets_name', ['name'])
@Unique('uq_outlets_company_code', ['companyId', 'code'])
@Unique('uq_outlets_company_name', ['companyId', 'name'])
export class Outlet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  companyId: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @ManyToOne(() => Company, (company) => company.outlets, {
    onDelete: 'CASCADE',
  })
  company: Company;

  @OneToMany(() => OutletMenuItem, (outletMenuItem) => outletMenuItem.outlet)
  assignedMenuItems: OutletMenuItem[];

  @OneToMany(() => Inventory, (inventory) => inventory.outlet)
  inventory: Inventory[];

  // @OneToMany(() => Sale, (s) => s.outlet)
  // sales: Sale[];

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updatedAt: Date;
}
