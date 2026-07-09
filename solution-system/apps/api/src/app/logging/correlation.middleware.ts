import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { correlationStorage } from './correlation-storage';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      randomUUID();

    // Set correlation ID on response headers so clients can trace it
    res.setHeader('x-correlation-id', correlationId);

    // Track request finish event and log HTTP request details
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      correlationStorage.run(correlationId, () => {
        this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
      });
    });

    // Run the rest of the request lifecycle within AsyncLocalStorage context
    correlationStorage.run(correlationId, () => {
      this.logger.log(`Incoming request: ${method} ${originalUrl}`);
      next();
    });
  }
}
