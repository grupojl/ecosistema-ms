-- Sincroniza el schema con las migraciones.
--
-- Estos objetos existen en schema.prisma pero NINGUNA migración los creaba (probablemente se aplicaron con
-- `prisma db push`). Una base creada solo con `migrate deploy` (staging nuevo, recuperación ante desastre)
-- fallaba al leer o escribir cualquier conversación ("la columna no existe").
--
-- TODO es idempotente (IF NOT EXISTS): en una base que YA los tiene (la de producción actual) no hace nada.

-- Conversation.market_country (ADR-014)
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "market_country" TEXT;

-- OrganizationConfig (ADR-019 v2) → tabla "organization_configs"
CREATE TABLE IF NOT EXISTS "organization_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ecosystemId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "timezone" TEXT NOT NULL DEFAULT 'America/Buenos_Aires',
    "locale" TEXT NOT NULL DEFAULT 'es',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "organization_configs_ecosystemId_idx" ON "organization_configs"("ecosystemId");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_configs_ecosystemId_organizationId_key"
    ON "organization_configs"("ecosystemId", "organizationId");
