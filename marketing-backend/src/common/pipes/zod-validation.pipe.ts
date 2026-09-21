import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema }                          from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      );
    }
    return result.data;
  }
}
