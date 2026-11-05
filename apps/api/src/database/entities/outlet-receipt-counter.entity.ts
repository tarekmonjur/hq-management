import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numberTransformer } from '@/common/transformers/number.transformer.js';
import { Outlet } from './outlet.entity.js';

@Entity('outlet_receipt_counters')
@Check('chk_receipt_counter_non_negative', '"last_number" >= 0')
export class OutletReceiptCounter {
  @PrimaryGeneratedColumn('uuid')
  outletId: string;

  @Column({ type: 'bigint', nullable: false, transformer: numberTransformer })
  lastNumber: number;

  @OneToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'outlet_id',
    foreignKeyConstraintName: 'fk_receipt_counters_outlet',
  })
  outlet: Outlet;
}
