import { Column, Decimal128, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('liquidity_pool')
export class LiquidityPool{
    @PrimaryGeneratedColumn('uuid')
    id:string

    @Column({type:'uuid'})
    asset_id:string;

    @Column({type:'decimal', default: 10000})
    asset_balance:number;

    @Column({type:'decimal', default: 1000000})
    currency_balance:number;

    get k(): number {
    return Number(this.currency_balance) * Number(this.asset_balance);
  }
}