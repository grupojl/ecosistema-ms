// Contrato de custom claims que el sass-back de cada ecosistema emite en el token Firebase.
// Referencia: ADR-001 / ADR-003
import { z } from "zod";

export const TenantClaimsSchema = z.object({
  ecosystemId:      z.string().min(1),
  organizationId:   z.string().min(1),
  organizationName: z.string().min(1).optional(),
  role:             z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),

  // Permisos por producto de la plataforma (chat, payments, marketing, ...)
  permissions: z.record(
    z.string(),
    z.object({ canRead: z.boolean(), canWrite: z.boolean().optional() }),
  ).optional(),
});

export type TenantClaims = z.infer<typeof TenantClaimsSchema>;
