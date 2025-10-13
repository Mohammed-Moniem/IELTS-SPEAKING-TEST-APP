import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  PRO = 'pro'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  TRIAL = 'trial'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true, select: false })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE
  })
  subscriptionTier: SubscriptionTier;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE
  })
  subscriptionStatus: SubscriptionStatus;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionStartDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionEndDate: Date;

  @Column({ type: 'int', default: 0 })
  practiceSessionsUsed: number; // Current month

  @Column({ type: 'int', default: 0 })
  simulationSessionsUsed: number; // Current month

  @Column({ type: 'timestamp', nullable: true })
  usageResetDate: Date; // When to reset monthly usage

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  preferences: {
    language?: string;
    notifications?: boolean;
    difficulty?: 'easy' | 'medium' | 'hard';
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Computed properties
  get isPremiumUser(): boolean {
    return this.subscriptionTier === SubscriptionTier.PREMIUM || this.subscriptionTier === SubscriptionTier.PRO;
  }

  get isProUser(): boolean {
    return this.subscriptionTier === SubscriptionTier.PRO;
  }

  get hasActiveSubscription(): boolean {
    return (
      this.subscriptionStatus === SubscriptionStatus.ACTIVE || this.subscriptionStatus === SubscriptionStatus.TRIAL
    );
  }
}
