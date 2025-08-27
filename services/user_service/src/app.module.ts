import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { LoggerMiddleware } from './logger.middleware'; // <-- IMPORT THE LOGGER
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    UserModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      // Reads the connection string set in docker comp
      url: process.env.DATABASE_URL,
      // Load any entity files.
      autoLoadEntities: true,
      // auto create tables depending on entities
      synchronize: true,})
  ],
  controllers: [AppController],
  providers: [AppService],
})
// We implement the NestModule interface to gain access to the configure method.
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Applied loggerMiddleware to every route in the application.
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}