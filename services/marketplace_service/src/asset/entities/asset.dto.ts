import { IsString, MaxLength, MinLength, IsUrl, IsOptional } from "class-validator";

export class AssetDto {
   
    @IsString()
    @MinLength(2)
    @MaxLength(30)
    name: string;

    @IsString()
    @MinLength(5)
    @MaxLength(240)
    description: string;

    @IsOptional()
    @IsString()
    @IsUrl({ require_tld: false })
    imageUrl?: string;
}