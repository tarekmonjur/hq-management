import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Outlet } from './outlet.entity.js';
import { User } from './user.entity.js';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'varchar', length: 255 })
  name: string;

  @OneToMany(() => Outlet, (outlet) => outlet.company)
  outlets: Outlet[];

  @OneToMany(() => User, (user) => user.company)
  users: Relation<User[]>;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updatedAt: Date;
}
