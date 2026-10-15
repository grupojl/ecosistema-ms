// src/infrastructure/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    // Sin query string: puede traer tokens (hub.verify_token, etc.)
    const method = req.method;
    const url = req.url.split('?')[0];
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const res = context.switchToHttp().getResponse<Response>();
          this.logger.log(`${method} ${url} → ${res.statusCode} [${ms}ms]`);
        },
        error: () => {
          const ms = Date.now() - start;
          this.logger.warn(`${method} ${url} → ERROR [${ms}ms]`);
        },
      }),
    );
  }
}
