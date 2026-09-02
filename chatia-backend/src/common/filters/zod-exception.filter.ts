// common/filters/zod-exception.filter.ts
//
// Captura ZodErrors que se lanzan fuera del pipe (p. ej. en el service).
// Registrar en main.ts: app.useGlobalFilters(new ZodExceptionFilter());
//
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type { Response } from 'express';

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ZodExceptionFilter.name);

  catch(exception: ZodError, host: ArgumentsHost): void {
    const ctx  = host.switchToHttp();
    const res  = ctx.getResponse<Response>();

    const formatted: Record<string, string[]> = {};
    for (const issue of exception.issues) {
      const path = issue.path.join('.') || '_root';
      if (!formatted[path]) formatted[path] = [];
      formatted[path].push(issue.message);
    }

    this.logger.debug(`ZodError caught: ${JSON.stringify(formatted)}`);

    res.status(400).json({
      statusCode: 400,
      message:    'Validation failed',
      errors:     formatted,
    });
  }
}
