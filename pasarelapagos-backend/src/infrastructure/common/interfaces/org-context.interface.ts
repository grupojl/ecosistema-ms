// pasarelapagos-backend/src/common/interfaces/org-context.interface.ts
// Contexto inyectado por TenantGuard en cada request autenticado.
export interface OrgContext {
  tenantId:       string;           // ecosystemId — identifica al cliente de la plataforma
  organizationId: string;           // UUID del org en el owner-dashboard
  userId:         string;           // firebaseUid del usuario
  canRead:        boolean;          // productPermissions["payments"].canRead
  canWrite:       boolean;          // productPermissions["payments"].canWrite
  isApiKey:       boolean;          // true = path B2B, false = path SSO
}
