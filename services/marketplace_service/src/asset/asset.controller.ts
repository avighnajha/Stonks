import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Request, RequestMapping, UseGuards, ValidationPipe, Logger } from "@nestjs/common";
import { AssetDto } from "./entities/asset.dto";
import { ApproveAssetDto } from "./dto/approve-asset.dto";
import { AuthGuard } from "@nestjs/passport";
import { resolveSoa } from "dns";
import { UserRole } from "src/auth/user-role.enum";
import { RolesGuard } from "src/auth/roles.guard";
import { Roles } from "src/auth/roles.decorator";
import { AssetService } from "./asset.service";

@Controller('assets')
export class AssetController{
    private readonly logger = new Logger(AssetController.name);
    constructor(private readonly assetService: AssetService){}

    @Get('all')
    getAllAssets(){
        return this.assetService.getAllAssets();
    }

    @Get('approved')
    getApprovedAssets(){
        return this.assetService.getApprovedAssets();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string){
        return this.assetService.findOne(id);
    }

    @Post('submit')
    @UseGuards(AuthGuard('jwt'))
    submit(
        @Request() req,
        @Body(ValidationPipe) assetDto: AssetDto){
        const userId = req.user.userId;
        return this.assetService.submit(assetDto, userId);
    }

    @Patch(':id/approve')
    @Roles(UserRole.ADMIN)
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    approve(@Param('id', ParseUUIDPipe) id: string, @Request() req, @Body(ValidationPipe) dto: ApproveAssetDto){
        const adminUserId = req.user?.userId;
        this.logger.log(`Approving asset: ${id} by admin: ${adminUserId}`);
        return this.assetService.approve(id, dto, adminUserId);
    }
}