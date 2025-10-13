import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum SessionType {
  PRACTICE = 'practice',
  SIMULATION = 'simulation'
}

@Entity('usage_logs')
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: SessionType
  })
  sessionType: SessionType;

  @Column({ type: 'int', nullable: true })
  duration: number; // Duration in seconds

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    testPart?: number;
    overallBand?: number;
    topic?: string;
    completed?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;
}
