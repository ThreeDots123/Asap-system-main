import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent') || '';

    const start = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - start;
      const { statusCode } = res;

      console.log(
        `[${method}] ${originalUrl} ${statusCode} - ${responseTime}ms - ${ip} - ${userAgent}`,
      );
    });

    next();
  }
}
