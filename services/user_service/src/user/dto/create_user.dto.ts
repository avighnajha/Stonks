import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateUserDto {
    @IsEmail()
    email: string;
    @IsString()
    @MinLength(8, {message: 'Password must be 8 characters lond'})
    password: string;
}