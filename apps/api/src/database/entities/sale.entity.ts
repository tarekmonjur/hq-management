import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { numberTransformer } from '../../common/transformers/number.transformer.js';
import { Outlet } from './outlet.entity.js';
import { SaleItem } from './sale-item.entity.js';

@Entity('sales')
@Unique('uq_sales_outlet_receipt', ['outletId', 'receiptNo'])
@Unique('uq_sales_outlet_idempotency', ['outletId', 'idempotencyKey'])
@Index('idx_sales_outlet', ['outletId'])
@Index('idx_sales_outlet_created', ['outletId', 'createdAt'])
@Check('chk_sales_total_non_negative', '"total" >= 0')
@Check('chk_sales_receipt_positive', '"receipt_no" > 0')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  outletId: string;

  @Column({ type: 'bigint', nullable: false, transformer: numberTransformer })
  receiptNo: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: false,
    transformer: numberTransformer,
  })
  total: number;

  // Client-sent Idempotency-Key. Also used for offline sync. Multiple NULLs are allowed by Postgres.
  @Column({ type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @ManyToOne(() => Outlet, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'outlet_id',
    foreignKeyConstraintName: 'fk_sales_outlet',
  })
  outlet: Relation<Outlet>;

  @OneToMany(() => SaleItem, (item) => item.sale, {
    cascade: true,
  })
  items: Relation<SaleItem[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
