import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity('holding')
@Unique(['user_id', 'asset_id'])
export class Holding{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    user_id: string;

    @Column({type: 'uuid'})
    asset_id: string;

    @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
    quantity: number;

    @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
    frozen_quantity: number;

    @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
    average_buy_price: number;
}