import { Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { Asset, Status } from "./entities/asset.entity";
import { AssetDto } from "./entities/asset.dto";
import { ApproveAssetDto } from "./dto/approve-asset.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom, NotFoundError } from "rxjs";
import { statSync } from "fs";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class AssetService{
    constructor(
        @InjectRepository(Asset)
        private readonly assetRepository: Repository<Asset>,
        private readonly httpService: HttpService){}

    async getAllAssets() : Promise<Asset[]>{
        return this.assetRepository.find()
    }

    async getApprovedAssets(): Promise<Asset[]>{
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

    async approve(assetId: string, dto?: ApproveAssetDto, adminUserId?: string): Promise<Asset>{
        const asset = await this.assetRepository.findOne({where: {id: assetId}});
        if(!asset){
            throw new NotFoundException(`Asset with id: ${assetId} not found`)
        }
        // If approval DTO provided, persist economic fields
        if (dto) {
            asset.initial_price = dto.initialPrice as any;
            asset.total_supply = dto.totalSupply as any;
            asset.creator_split_percentage = dto.creatorPercentage as any;
        }

        // Create a new liquidity pool (keeps previous behavior)
        const tradingServiceUrl = 'http://trading_service:3004/trade/create-pool'
        try{
            await firstValueFrom(this.httpService.post(tradingServiceUrl,
                {assetId: assetId},
                {
                    headers: {
                        'x-internal-api-key': process.env.INTERNAL_API_KEY,
                    }
                }
            ));
        }catch (error){
            throw error;
        }

        // If economic fields are present, perform the split minting and seed the order book
        if (asset.total_supply && asset.creator_split_percentage != null) {
            const totalSupplyNum = Number(asset.total_supply as any);
            const creatorPct = Number(asset.creator_split_percentage as any);
            const creatorShares = Math.floor(totalSupplyNum * (creatorPct / 100));
            const adminShares = Math.max(0, totalSupplyNum - creatorShares);

            const portfolioUrl = process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio_service:3005';
            const tradingInternalUrlBase = process.env.TRADING_SERVICE_URL || 'http://trading_service:3004';

            try {
                // Mint creator shares
                await firstValueFrom(this.httpService.post(
                    `${portfolioUrl}/portfolio/mint`,
                    { userId: asset.submitted_by_user_id, assetId: assetId, quantity: creatorShares },
                    { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                ));

                // Mint admin/platform shares
                await firstValueFrom(this.httpService.post(
                    `${portfolioUrl}/portfolio/mint`,
                    { userId: adminUserId, assetId: assetId, quantity: adminShares },
                    { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                ));

                // Create initial sell order (admin posts a LIMIT sell for adminShares at initial_price)
                if (adminShares > 0 && asset.initial_price) {
                    await firstValueFrom(this.httpService.post(
                        `${tradingInternalUrlBase}/trade/internal/sell/${assetId}`,
                        { userId: adminUserId, assetAmount: adminShares, price: Number(asset.initial_price), type: 'LIMIT' },
                        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                    ));
                }
            } catch (e) {
                // If minting or seeding fails, log and rethrow to avoid leaving asset in inconsistent state
                throw e;
            }
        }

        asset.status = Status.APPROVED;
        return await this.assetRepository.save(asset);
    }
}