import { IsString, MaxLength, MinLength } from "class-validator";

export class AssetDto {
    @IsString()
    id: string;
    
    @IsString()
    @MinLength(2)
    @MaxLength(30)
    name: string;

    description: string;

    imageUrl: string;
}