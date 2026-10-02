// common/pipes/zod-validation.pipe.ts
//
// Reemplaza el ValidationPipe de class-validator en los controllers REST.
// Uso en controller:
//
//   const CreateContactSchema = z.object({ name: z.string().min(1) });
//   type CreateContactInput = z.infer<typeof CreateContactSchema>;
//
//   @Post()
//   create(@Body(new ZodValidationPipe(CreateContactSchema)) dto: CreateContactInput) { ... }
//
// O como pipe global en main.ts:
//   app.useGlobalPipes(new ZodValidationPipe());  // sin schema → solo parsea JSON
//
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (!this.schema) return value;

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const formatted = this.formatZodError(result.error);
      this.logger.debug(`Validation failed: ${JSON.stringify(formatted)}`);
      throw new BadRequestException({
        message:    'Validation failed',
        statusCode: 400,
        errors:     formatted,
      });
    }

    return result.data;
  }

  private formatZodError(error: ZodError): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_root';
      if (!formatted[path]) formatted[path] = [];
      formatted[path].push(issue.message);
    }
    return formatted;
  }
}
