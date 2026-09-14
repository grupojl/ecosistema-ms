import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ZodError }       from 'zod';
import type { Response }  from 'express';

/**
 * Convierte ZodError en HTTP 400 con detalles de campo.
 * ADR-009 / DT-027 — registrar en main.ts ANTES de ValidationPipe.
 *
 * app.useGlobalFilters(new ZodExceptionFilter());
 * app.useGlobalPipes(new ValidationPipe({ ... }));
 */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error:      'Validation Error',
      message:    'La entrada no cumple el schema requerido',
      details:    exception.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
        code:    e.code,
      })),
    });
  }
}
