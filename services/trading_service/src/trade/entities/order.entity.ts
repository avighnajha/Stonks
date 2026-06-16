import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

export enum OrderSide { BUY = 'BUY', SELL = 'SELL' }
export enum OrderType { LIMIT = 'LIMIT', MARKET = 'MARKET' }
export enum OrderStatus { OPEN = 'OPEN', PARTIALLY_FILLED = 'PARTIALLY_FILLED', FILLED = 'FILLED', CANCELLED = 'CANCELLED' }

@Entity('orders')
export class Order {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'uuid' })
    asset_id: string;

    @Column({ type: 'enum', enum: OrderSide })
    side: OrderSide;

    @Column({ type: 'enum', enum: OrderType })
    type: OrderType;

    @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.OPEN })
    status: OrderStatus;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    price: number;

    @Column({ type: 'decimal', precision: 12, scale: 4 })
    initial_quantity: number;

    @Column({ type: 'decimal', precision: 12, scale: 4 })
    remaining_quantity: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}