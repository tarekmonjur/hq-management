import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MenuItem } from './menu-item.entity.js';
import { Outlet } from './outlet.entity.js';

@Entity('inventories')
@Index('idx_inventories_outlet', ['outletId'])
@Index('idx_inventories_menu_item', ['menuItemId'])
@Unique('uq_inventories_outlet_item', ['outletId', 'menuItemId'])
@Check('chk_inventories_quantity_non_negative', '"quantity" >= 0')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  outletId: string;

  @Column({ type: 'uuid', nullable: false })
  menuItemId: string;

  @Column({ type: 'int', default: 0, nullable: false })
  quantity: number;

  @ManyToOne(() => Outlet, (outlet) => outlet.inventory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'outlet_id',
    foreignKeyConstraintName: 'fk_inventory_outlet',
  })
  outlet: Outlet;

  @ManyToOne(() => MenuItem, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'menu_item_id',
    foreignKeyConstraintName: 'fk_inventory_menu_item',
  })
  menuItem: MenuItem;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
