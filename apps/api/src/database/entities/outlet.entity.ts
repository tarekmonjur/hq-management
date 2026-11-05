import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
  Unique,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Company } from './company.entity.js';
import { OutletMenuItem } from './outlet-menu-item.entity.js';
import { Inventory } from './inventory.entity.js';
import { Sale } from './sale.entity.js';

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
  @JoinColumn({
    name: 'company_id',
    foreignKeyConstraintName: 'fk_outlet_company',
  })
  company: Relation<Company>;

  @OneToMany(() => OutletMenuItem, (outletMenuItem) => outletMenuItem.outlet)
  assignedMenuItems: Relation<OutletMenuItem[]>;

  @OneToMany(() => Inventory, (inventory) => inventory.outlet)
  inventory: Relation<Inventory[]>;

  @OneToMany(() => Sale, (sale) => sale.outlet)
  sales: Relation<Sale[]>;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updatedAt: Date;
}
