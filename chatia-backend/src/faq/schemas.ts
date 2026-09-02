// chatia-backend/src/faq/schemas.ts
// Reemplaza DTOs de document, knowledge-base y query
import { z } from 'zod';

export const CreateKnowledgeBaseSchema = z.object({
  name:        z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  projectId:   z.string().min(1),
});

export const CreateKbDocumentSchema = z.object({
  title:      z.string().min(1).max(200),
  sourceType: z.enum(['TEXT', 'URL', 'FILE']).default('TEXT'),
  sourceUrl:  z.string().url().optional(),
  rawContent: z.string().max(100_000).optional(),
  tags:       z.array(z.string()).default([]),
}).refine(
  (d) => d.sourceType !== 'URL' || !!d.sourceUrl,
  { message: 'sourceUrl es requerido cuando sourceType es URL', path: ['sourceUrl'] },
).refine(
  (d) => d.sourceType !== 'TEXT' || !!d.rawContent,
  { message: 'rawContent es requerido cuando sourceType es TEXT', path: ['rawContent'] },
);

export const FaqQuerySchema = z.object({
  kbId:     z.string().min(1),
  question: z.string().min(3).max(1000),
  topK:     z.number().int().min(1).max(10).default(3),
});

export type CreateKnowledgeBaseInput = z.infer<typeof CreateKnowledgeBaseSchema>;
export type CreateKbDocumentInput    = z.infer<typeof CreateKbDocumentSchema>;
export type FaqQueryInput            = z.infer<typeof FaqQuerySchema>;
