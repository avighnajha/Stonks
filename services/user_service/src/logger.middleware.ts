// Path: services/user-service/src/logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('--- INCOMING REQUEST RECEIVED ---');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    // This is the most important part. We will print every single header.
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('---------------------------------');

    // next() passes the request to the next handler (your controller).
    next();
  }
}