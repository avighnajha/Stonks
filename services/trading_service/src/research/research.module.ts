import {Module} from '@nestjs/common';
import {ResearchController,ResearchWorkerController,WorkerGuard} from './research.controller';
import {ResearchService} from './research.service';
@Module({controllers:[ResearchController,ResearchWorkerController],providers:[ResearchService,WorkerGuard]})
export class ResearchModule {}
