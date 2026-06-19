// Path: services/user-service/src/logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);
  use(req: Request, res: Response, next: NextFunction) {
    this.logger.log('--- INCOMING REQUEST RECEIVED ---');
    this.logger.log(`Method: ${req.method}`);
    this.logger.log(`URL: ${req.originalUrl}`);
    // This is the most important part. We will print every single header.
    this.logger.debug(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    this.logger.log('---------------------------------');

    // next() passes the request to the next handler (your controller).
    next();
  }
}