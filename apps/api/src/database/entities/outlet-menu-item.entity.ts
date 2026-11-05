import {
  Entity,
  Check,
  Column,
  ManyToOne,
  Unique,
  Index,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { numberTransformer } from '@/common/transformers/number.transformer.js';
import { Outlet } from './outlet.entity.js';
import { MenuItem } from './menu-item.entity.js';

@Entity('outlet_menu_items')
@Unique('uq_outlet_menu_items_outlet_item', ['outletId', 'menuItemId'])
@Index('idx_outlet_menu_items_outlet', ['outletId'])
@Index('idx_outlet_menu_items_menu_item', ['menuItemId'])
@Check('chk_outlet_menu_items_outlet_price', '"outlet_price" >= 0')
export class OutletMenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  outletId: string;

  @Column({ type: 'uuid', nullable: false })
  menuItemId: string;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numberTransformer,
  })
  outletPrice: number;

  @Column({ type: 'boolean', default: false, nullable: false })
  isActive: boolean;

  @ManyToOne(() => Outlet, (outlet) => outlet.assignedMenuItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'outlet_id',
    foreignKeyConstraintName: 'fk_outlet_menu_items_outlet',
  })
  outlet: Outlet;

  @ManyToOne(() => MenuItem, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'menu_item_id',
    foreignKeyConstraintName: 'fk_outlet_menu_items_menu_item',
  })
  menuItem: MenuItem;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
