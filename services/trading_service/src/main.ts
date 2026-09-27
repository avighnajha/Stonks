import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET || !process.env.INTERNAL_API_KEY)
    throw new Error('JWT_SECRET and INTERNAL_API_KEY must be configured');
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '9mb' }));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
