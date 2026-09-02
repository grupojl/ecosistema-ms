// chatia-backend/src/common/filters/all-exceptions.filter.ts
// Filtro global que captura ZodError + HttpException.
// Registrar en main.ts: app.useGlobalFilters(new AllExceptionsFilter());
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx  = host.switchToHttp();
    const res  = ctx.getResponse<Response>();

    if (exception instanceof ZodError) {
      const formatted: Record<string, string[]> = {};
      for (const issue of exception.issues) {
        const path = issue.path.join('.') || '_root';
        if (!formatted[path]) formatted[path] = [];
        formatted[path].push(issue.message);
      }
      res.status(400).json({ statusCode: 400, message: 'Validation failed', errors: formatted });
      return;
    }

    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message:    'Internal server error',
    });
  }
}
