import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  ParseUUIDPipe,
  Headers,
  Request,
  UseGuards,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { timingSafeEqual } from 'crypto';
import { ResearchService } from './research.service';
import { strategies } from './manifest';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
@Controller('research')
@UseGuards(AuthGuard('jwt'))
export class ResearchController {
  constructor(private readonly s: ResearchService) {}
  @Get('catalogue') catalogue() {
    return this.s.catalogue();
  }
  @Get('strategies') strategies() {
    return strategies().map((id) => ({
      id,
      fixture: ['idle', 'scripted'].includes(id),
    }));
  }
  @Put('catalogue/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  template(@Param('id', ParseUUIDPipe) id: string, @Body() b: any) {
    return this.s.template(id, b);
  }
  @Get('experiments') list(@Request() r) {
    return this.s.list(r.user.userId);
  }
  @Post('experiments') create(@Request() r, @Body() b: any) {
    return this.s.save(r.user.userId, b);
  }
  @Put('experiments/:id') save(
    @Request() r,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: any,
  ) {
    return this.s.save(r.user.userId, b, id);
  }
  @Post('experiments/:id/runs') launch(
    @Request() r,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @Body() b: any,
  ) {
    return this.s.launch(r.user.userId, id, key, b?.seed);
  }
  @Get('runs') runs(@Request() r) {
    return this.s.runs(r.user.userId);
  }
  @Get('runs/:id') get(@Request() r, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.get(r.user.userId, id);
  }
  @Post('runs/:id/cancel') cancel(
    @Request() r,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.cancel(r.user.userId, id);
  }
}
@Injectable()
export class WorkerGuard implements CanActivate {
  canActivate(c: ExecutionContext) {
    const key = process.env.RESEARCH_WORKER_KEY;
    const got = c.switchToHttp().getRequest().headers['x-research-key'];
    if (
      !key ||
      typeof got !== 'string' ||
      Buffer.byteLength(got) !== Buffer.byteLength(key) ||
      !timingSafeEqual(Buffer.from(got), Buffer.from(key))
    )
      throw new UnauthorizedException();
    return true;
  }
}
// Direct internal service endpoint; gateway deliberately does not route this prefix.
@Controller('research-worker')
@UseGuards(WorkerGuard)
export class ResearchWorkerController {
  constructor(private readonly s: ResearchService) {}
  @Post('claim') claim() {
    return this.s.claim();
  }
  @Post(':id/heartbeat') heartbeat(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-run-token') t: string,
    @Body() b: any,
  ) {
    return this.s.heartbeat(id, t, b);
  }
  @Post(':id/finish') finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-run-token') t: string,
    @Body() b: any,
  ) {
    return this.s.finish(id, t, b);
  }
}
