import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  Check,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { numberTransformer } from '@/common/transformers/number.transformer.js';

@Entity('menu_items')
@Unique('uq_menu_items_name', ['name'])
@Check('chk_menu_items_base_price', '"base_price" IS NULL OR "base_price" >= 0')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: numberTransformer,
  })
  basePrice: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
