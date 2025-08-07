import { Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { Asset, Status } from "./entities/asset.entity";
import { AssetDto } from "./entities/asset.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom, NotFoundError } from "rxjs";
import { statSync } from "fs";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class AssetService{
    constructor(
        @InjectRepository(Asset)
        private readonly assetRepository: Repository<Asset>){}
        private readonly httpService: HttpService;

    async getAllAssets() : Promise<Asset[]>{
        return this.assetRepository.find({where: {status: Status.APPROVED}})
    }

    async findOne(assetId:string): Promise<Asset>{
        const asset = await this.assetRepository.findOne({where: {id: assetId, status: Status.APPROVED
        }})
        if(!asset){
            throw new NotFoundException(`Asset with id: ${assetId} not found`);
        }
        return asset;
    }

    async submit(assetDto: AssetDto, userId: string){
        const newAsset = this.assetRepository.create({...assetDto, submitted_by_user_id: userId, status:Status.PENDING});
        return this.assetRepository.save(newAsset);
    }

    async approve(assetId: string): Promise<Asset>{
        const asset = await this.assetRepository.findOne({where: {id: assetId}});
        if(!asset){
            throw new NotFoundException(`Asset with id: ${assetId} not found`)
        }
        asset.status = Status.APPROVED;
        
        //Create a new liquidity pool
        const tradingServiceUrl = 'http://trade_service:3004/trade/create-pool'
        try{
            firstValueFrom(this.httpService.post(tradingServiceUrl,
                {assetId: assetId},
                {
                    headers: {
                        'x-internal-api-key': process.env.INTERNAL_API_KEY,
                    }
                }
            ));
        }catch (error){
            return error;
        }
        return await this.assetRepository.save(asset);
    }
}