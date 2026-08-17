// TenantContext — contexto resuelto en cada request autenticado
// Mismo contrato que welver/@real/auth-server para consistencia entre ecosistemas

export type TenantRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface TenantContext {
  ecosystemId:      string;
  organizationId:   string;
  organizationName: string;
  firebaseUid:      string;
  email:            string;
  name:             string;
  role:             TenantRole;
  canRead:          boolean;
  canWrite:         boolean;
  agentId?:         string;
}
