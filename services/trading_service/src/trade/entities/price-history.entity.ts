import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('price_history')
export class PriceHistory {
  @Column({ type: 'bigint', generated: 'increment' })
  sequence: string;
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  asset_id: string;

  @Column()
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @CreateDateColumn()
  timestamp: Date;
}
