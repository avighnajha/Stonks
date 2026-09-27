import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Asset, Status } from './entities/asset.entity';
import { AssetDto } from './entities/asset.dto';
import { ApproveAssetDto } from './dto/approve-asset.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom, NotFoundError } from 'rxjs';
import { statSync } from 'fs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    private readonly httpService: HttpService,
  ) {}

  async getAllAssets(): Promise<Asset[]> {
    return this.assetRepository.find();
  }

  async getApprovedAssets(): Promise<Asset[]> {
    return this.assetRepository.find({ where: { status: Status.APPROVED } });
  }

  async findOne(assetId: string): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: { id: assetId, status: Status.APPROVED },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with id: ${assetId} not found`);
    }
    return asset;
  }

  async submit(assetDto: AssetDto, userId: string) {
    const newAsset = this.assetRepository.create({
      ...assetDto,
      submitted_by_user_id: userId,
      status: Status.PENDING,
    });
    return this.assetRepository.save(newAsset);
  }

  async approve(
    assetId: string,
    dto: ApproveAssetDto,
    adminUserId: string,
  ): Promise<Asset> {
    const base =
      process.env.TRADING_SERVICE_URL || 'http://trading_service:3004';
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${base}/trade/internal/issue/${assetId}`,
          { ...dto, adminUserId },
          {
            headers: {
              'x-internal-api-key': process.env.INTERNAL_API_KEY,
              'idempotency-key': `issue:${assetId}`,
            },
            timeout: 15000,
          },
        ),
      );
      return response.data;
    } catch (e) {
      throw new HttpException(
        e.response?.data ||
          'Issuance outcome unavailable; retry unchanged request',
        e.response?.status || 502,
      );
    }
  }
  async reject(assetId: string, adminUserId?: string): Promise<Asset> {
    return this.assetRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [73190421]);
      const asset = await manager.findOne(Asset, { where: { id: assetId } });
      if (!asset) throw new NotFoundException('Asset not found');
      if (asset.status !== Status.PENDING)
        throw new BadRequestException('Only pending assets can be rejected');
      asset.status = Status.REJECTED;
      return manager.save(asset);
    });
  }
}
