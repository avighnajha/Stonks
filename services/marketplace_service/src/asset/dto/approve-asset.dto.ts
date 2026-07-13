import { IsNumber, Min, Max } from "class-validator";

export class ApproveAssetDto {
    @IsNumber()
    @Min(0.01)
    initialPrice: number;

    @IsNumber()
    @Min(1)
    totalSupply: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    creatorPercentage: number;
}
