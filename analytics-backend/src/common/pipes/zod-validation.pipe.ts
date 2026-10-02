// analytics-backend/src/common/pipes/zod-validation.pipe.ts
// Mismo patrón que chatia-backend — ADR-001 (Zod inline, sin class-validator)
import {
  PipeTransform, Injectable, ArgumentMetadata, BadRequestException,
} from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (!this.schema) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "_root";
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      throw new BadRequestException({ message: "Validation failed", errors });
    }
    return result.data;
  }
}
