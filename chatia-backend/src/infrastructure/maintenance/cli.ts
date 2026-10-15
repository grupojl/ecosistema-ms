// src/infrastructure/maintenance/cli.ts — punto de entrada de tareas de mantenimiento (se ejecuta con node sobre dist/).
//   node dist/infrastructure/maintenance/cli.js encrypt-tokens        (DRY_RUN=1 para simular)
import 'dotenv/config';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import { encryptChannelTokens } from '@/infrastructure/maintenance/encrypt-channel-tokens.js';

async function main(): Promise<void> {
  const task = process.argv[2];
  if (task !== 'encrypt-tokens') {
    console.error(
      'Uso: node dist/infrastructure/maintenance/cli.js encrypt-tokens   (DRY_RUN=1 para simular)',
    );
    process.exit(2);
  }

  const prisma = new PrismaService();
  await prisma.onModuleInit();
  try {
    const dryRun = process.env['DRY_RUN'] === '1';
    const report = await encryptChannelTokens(
      prisma,
      TokenCipher.fromEnv(),
      dryRun,
    );
    console.log(
      `${dryRun ? '[SIMULACRO] ' : ''}Cuentas revisadas: ${report.scanned} · cifradas: ${report.updated} · ya estaban cifradas: ${report.skipped}`,
    );
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
