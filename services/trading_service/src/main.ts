import { NestFactory } from '@nestjs/core';
// Start compensation worker (side-effect import)
import './compensation/compensation.worker';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
