// src/infrastructure/maintenance/encrypt-channel-tokens.ts
//
// Cifra los secretos de canales que quedaron EN CLARO antes de activar el cifrado en reposo
// (ChannelAccount.accessToken y extraConfig.appSecret). Es idempotente: lo ya cifrado no se toca.
// Uso:  CHANNEL_TOKEN_ENCRYPTION_KEY=... DATABASE_URL=... pnpm encrypt:tokens        (simulacro: DRY_RUN=1)
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import type { Prisma } from '@/generated/prisma/client.js';

export interface EncryptReport {
  scanned: number;
  updated: number;
  skipped: number;
}

type Db = Pick<PrismaService, 'channelAccount'>;

export async function encryptChannelTokens(
  db: Db,
  cipher: TokenCipher,
  dryRun = false,
): Promise<EncryptReport> {
  if (!cipher.enabled)
    throw new Error(
      'CHANNEL_TOKEN_ENCRYPTION_KEY no está definida: no hay con qué cifrar',
    );

  const report: EncryptReport = { scanned: 0, updated: 0, skipped: 0 };
  let cursor: string | undefined;

  for (;;) {
    const batch = await db.channelAccount.findMany({
      take: 200,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, accessToken: true, extraConfig: true },
    });
    if (batch.length === 0) break;

    for (const account of batch) {
      report.scanned++;
      const extra = (account.extraConfig ?? {}) as Record<string, unknown>;
      const encryptedExtra = cipher.encryptExtraConfig(extra);
      const tokenChanged = !cipher.isEncrypted(account.accessToken);
      const extraChanged =
        JSON.stringify(encryptedExtra) !== JSON.stringify(extra);

      if (!tokenChanged && !extraChanged) {
        report.skipped++;
        continue;
      }
      if (!dryRun) {
        await db.channelAccount.update({
          where: { id: account.id },
          data: {
            ...(tokenChanged
              ? { accessToken: cipher.encrypt(account.accessToken) }
              : {}),
            ...(extraChanged
              ? { extraConfig: encryptedExtra as Prisma.InputJsonValue }
              : {}),
          },
        });
      }
      report.updated++;
    }
    cursor = batch[batch.length - 1].id;
  }
  return report;
}
