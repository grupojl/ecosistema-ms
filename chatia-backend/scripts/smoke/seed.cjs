#!/usr/bin/env node
// Datos mínimos para probar el circuito de mensajes en LOCAL: ecosistema + organización + proyecto con asistente
// + una cuenta de WhatsApp. Idempotente (se puede correr varias veces). Requiere `pnpm build` (usa dist/).
//
//   DATABASE_URL=postgresql://... CHANNEL_TOKEN_ENCRYPTION_KEY=... node scripts/smoke/seed.cjs
//
// Imprime los valores que usa smoke-webhook.js:  external-id, verify-token, secret.
const path = require('path');

const { PrismaService } = require(
  path.join(__dirname, '..', '..', 'dist', 'infrastructure', 'prisma', 'prisma.service.js'),
);
const { TokenCipher } = require(
  path.join(__dirname, '..', '..', 'dist', 'infrastructure', 'security', 'token-cipher.js'),
);

const EXTERNAL_ID = process.env.SMOKE_EXTERNAL_ID || 'smoke-phone-1';
const ORG_ID = 'smoke-org';
const ECO_ID = 'smoke-eco';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
  const cipher = TokenCipher.fromEnv(process.env);
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  try {
    await prisma.ecosystem.upsert({
      where: { id: ECO_ID },
      update: {},
      create: { id: ECO_ID, firebaseProjectId: 'smoke-fb', name: 'Smoke', config: { projectType: 'welver' } },
    });
    await prisma.organization.upsert({
      where: { id: ORG_ID },
      update: {},
      create: { id: ORG_ID, ecosystemId: ECO_ID, name: 'Smoke Org', slug: 'smoke-org' },
    });
    const project = await prisma.project.upsert({
      where: { organizationId_slug: { organizationId: ORG_ID, slug: 'smoke' } },
      update: {},
      create: { organizationId: ORG_ID, slug: 'smoke', name: 'Smoke' },
    });
    await prisma.assistantConfig.upsert({
      where: { projectId: project.id },
      update: { isEnabled: true },
      create: {
        projectId: project.id,
        organizationId: ORG_ID,
        systemPrompt: 'Sos un asistente de prueba. Respondé breve.',
      },
    });
    const account = await prisma.channelAccount.upsert({
      where: { channelType_externalId: { channelType: 'WHATSAPP', externalId: EXTERNAL_ID } },
      update: { projectId: project.id },
      create: {
        organizationId: ORG_ID,
        channelType: 'WHATSAPP',
        name: 'Smoke WhatsApp',
        externalId: EXTERNAL_ID,
        accessToken: cipher.encrypt('token-falso-de-prueba'),
        extraConfig: {},
        projectId: project.id,
      },
    });
    console.log(JSON.stringify({
      externalId: EXTERNAL_ID,
      verifyToken: account.webhookVerifyToken,
      organizationId: ORG_ID,
      channelAccountId: account.id,
    }));
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
