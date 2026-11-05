import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './user.entity.js';

@Entity({ name: 'user_sessions' })
@Index('idx_user_sessions_user', ['userId'])
@Index('idx_user_sessions_user_active', ['userId', 'createdAt'], {
  where: '"revoked_at" IS NULL',
})
@Index('idx_user_sessions_expires', ['expiresAt'])
@Index('uq_user_sessions_active_device', ['userId', 'deviceId'], {
  where: '"revoked_at" IS NULL AND "device_id" IS NOT NULL',
})
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  sessionId: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  refreshTokenHash: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceName?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  os?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  browser?: string | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  issuedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @ManyToOne(() => User, (u) => u.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_user_sessions_user',
  })
  user: Relation<User>;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: true })
  updatedAt: Date;
}
