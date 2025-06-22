// services/user-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // This configures the database connection for your entire app.
    TypeOrmModule.forRoot({
      type: 'postgres',
      // This reads the connection string from the environment variable
      // we set in docker-compose.yml.
      url: process.env.DATABASE_URL,
      // This will automatically load any entity files (like User, Wallet)
      // you create later.
      autoLoadEntities: true,
      // This is a development-only feature that automatically creates
      // your database tables based on your entities. Never use this
      // in production!
      synchronize: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}