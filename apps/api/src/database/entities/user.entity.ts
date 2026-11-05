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
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Outlet } from './outlet.entity.js';
import { UserRole } from '../../common/enums/user.enum.js';
import { UserSession } from './user-session.entity.js';

@Entity('users')
@Unique('uq_users_email', ['email'])
@Index('idx_users_outlet', ['outletId'])
@Index('idx_users_failed_attempts', ['failedLoginAttempts'])
@Check('chk_users_failed_attempts', '"failed_login_attempts" >= 0')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string;

  // select:false keeps the hash out of normal queries. Login must use addSelect('user.passwordHash').
  @Column({ type: 'varchar', length: 255, select: false, nullable: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 200, nullable: false })
  fullName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobileNo: string | null;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  outletId?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @ManyToOne(() => Outlet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'outlet_id',
    foreignKeyConstraintName: 'fk_users_outlet',
  })
  outlet?: Outlet | null;

  @OneToMany(() => UserSession, (s) => s.user)
  sessions: Relation<UserSession[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
