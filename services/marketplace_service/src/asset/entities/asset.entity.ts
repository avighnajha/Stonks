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

    @Column({type:'string', unique:true})
    name: string;

    @Column({type: 'text'})
    description: string;

    @Column({type: 'text'})
    imageUrl: string;

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