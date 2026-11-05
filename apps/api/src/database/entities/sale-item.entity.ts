import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { numberTransformer } from '@/common/transformers/number.transformer.js';
import { MenuItem } from './menu-item.entity.js';
import { Sale } from './sale.entity.js';

@Entity('sale_items')
@Index('idx_sale_items_sale', ['saleId'])
@Index('idx_sale_items_menu_item', ['menuItemId'])
@Check('chk_sale_items_quantity_positive', '"quantity" > 0')
@Check(
  'chk_sale_items_prices_non_negative',
  '"unit_price" >= 0 AND "line_total" >= 0',
)
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  saleId: string;

  @Column({ type: 'uuid', nullable: false })
  menuItemId: string;

  @Column({ type: 'int', nullable: false })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numberTransformer,
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numberTransformer,
  })
  lineTotal: number;

  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'sale_id',
    foreignKeyConstraintName: 'fk_sale_items_sale',
  })
  sale: Relation<Sale>;

  @ManyToOne(() => MenuItem, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'menu_item_id',
    foreignKeyConstraintName: 'fk_sale_items_menu_item',
  })
  menuItem: MenuItem;
}
