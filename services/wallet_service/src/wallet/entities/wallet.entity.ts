import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from 'typeorm'
import { UUID } from 'typeorm/driver/mongodb/bson.typings';

@Entity("wallets")
export class Wallet{
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    user_id: string;

    @Column({type: 'decimal', precision: 12, scale: 2, default: 10000})
    balance: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}