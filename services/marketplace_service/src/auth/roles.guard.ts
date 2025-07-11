import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector){}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        //If no roles required allow access
        if (!requiredRoles){
            return true;
        }
        const {user} = context.switchToHttp().getRequest();
        console.log(user.role, requiredRoles);
        //If roles required check if users role is same as req role
        return requiredRoles.some((role)=>user.role==role);
    }
}