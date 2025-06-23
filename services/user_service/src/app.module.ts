// services/user-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    UserModule,
    // This configures the database connection for your entire app.
    TypeOrmModule.forRoot({
      type: 'postgres',
      // Reads the connection string set in docker comp
      url: process.env.DATABASE_URL,
      // Load any entity files.
      autoLoadEntities: true,
      // auto create tables depending on entities
      synchronize: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}