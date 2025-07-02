import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Request, RequestMapping, UseGuards, ValidationPipe } from "@nestjs/common";
import { AssetDto } from "./entities/asset.dto";
import { AuthGuard } from "@nestjs/passport";
import { resolveSoa } from "dns";
import { UserRole } from "src/auth/user-role.enum";

@Controller('assets')
export class AssetController{
    constructor(private readonly assetService: AssetService){}

    @Get('all')
    getAllAssets(){
        return this.assetService.getAllAssets();
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
    approve(@Param('id', ParseUUIDPipe) id: string){
        return this.assetService.approve(id);
    }
}