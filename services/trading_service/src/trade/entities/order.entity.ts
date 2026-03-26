import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('orders')
export class Order{
    @PrimaryGeneratedColumn('uuid')
    id:string

    @Column({type:'uuid'})
    user_id:string;

    @Column({type:'uuid'})
    asset_id:string;

    @Column({type:'enum', enum: ['limit', 'market']})
    type: 'limit' | 'market';

    @Column({type:'enum', enum: ['buy', 'sell']})
    side: 'buy' | 'sell';

    @Column({type:'decimal', default: 10000})
    asset_balance:number;

    @Column({type:'decimal', default: 1000000})
    currency_balance:number;

    get k(): number {
    return Number(this.currency_balance) * Number(this.asset_balance);
  }
}