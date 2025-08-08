import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('holding')
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
    average_buy_price: number;
}