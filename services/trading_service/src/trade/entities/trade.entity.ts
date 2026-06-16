import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  asset_id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  quantity: number;

  @Column({ type: 'uuid' })
  buyer_id: string;

  @Column({ type: 'uuid' })
  seller_id: string;

  @Column({ type: 'uuid', nullable: true })
  buy_order_id: string;

  @Column({ type: 'uuid', nullable: true })
  sell_order_id: string;

  @CreateDateColumn()
  timestamp: Date;
}