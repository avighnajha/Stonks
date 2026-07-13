import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum Status {
    APPROVED= 'approved',
    PENDING= 'pending',
    REJECTED= 'rejected'

}

@Entity('assets')
export class Asset{

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type:'text', unique:true})
    name: string;

    @Column({type: 'text'})
    description: string;

    @Column({
        type: 'text',
        nullable: true})
    imageUrl?: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    initial_price?: number;

    @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
    total_supply?: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    creator_split_percentage?: number;

    @Column({
        type: 'simple-enum',
        enum: Status,
        default: Status.PENDING
    })
    status: string;

    @Column({type: 'uuid'})
    submitted_by_user_id: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

}