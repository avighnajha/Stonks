import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('holding')
export class Holding{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    user_id: string;

    @Column({type: 'uuid'})
    asset_id: string;

    @Column({type:'number'})
    quantity: number;

    @Column({type: 'number'})
    average_buy_price: number;
}