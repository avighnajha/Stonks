import { cp } from "fs";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('price_history')
export class PriceHistory{
    @PrimaryGeneratedColumn('uuid')
    id: string
    
    @Column()
    asset_id: string

    @Column()
    price: number

    @CreateDateColumn()
    timestamp: Date;
}