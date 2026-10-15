import { randomBytes } from 'node:crypto';
import { encryptChannelTokens } from '@/infrastructure/maintenance/encrypt-channel-tokens.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';

describe('encryptChannelTokens (migración de datos en claro)', () => {
  const cipher = TokenCipher.fromEnv({
    CHANNEL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  });
  let rows: Array<{
    id: string;
    accessToken: string;
    extraConfig: Record<string, unknown>;
  }>;
  const db = {
    channelAccount: {
      findMany: jest.fn(),
      update: jest.fn(
        (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.find((r) => r.id === args.where.id)!;
          Object.assign(row, args.data);
          return Promise.resolve(row);
        },
      ),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    rows = [
      {
        id: 'a',
        accessToken: 'token-en-claro',
        extraConfig: { appSecret: 'secreto-en-claro', wabaId: '1' },
      },
      { id: 'b', accessToken: cipher.encrypt('ya-cifrado'), extraConfig: {} },
      { id: 'c', accessToken: 'otro-en-claro', extraConfig: { wabaId: '2' } },
    ];
    // paginación por cursor: devuelve las filas y luego vacío
    db.channelAccount.findMany.mockImplementation(
      (args: { cursor?: { id: string } }) =>
        Promise.resolve(args.cursor ? [] : rows.map((r) => ({ ...r }))),
    );
  });

  it('cifra lo que estaba en claro y deja intacto lo ya cifrado', async () => {
    const report = await encryptChannelTokens(db as never, cipher);
    expect(report).toEqual({ scanned: 3, updated: 2, skipped: 1 });
    expect(cipher.decrypt(rows[0]!.accessToken)).toBe('token-en-claro');
    expect(cipher.decrypt(rows[0]!.extraConfig['appSecret'] as string)).toBe(
      'secreto-en-claro',
    );
    expect(rows[0]!.extraConfig['wabaId']).toBe('1');
    expect(cipher.decrypt(rows[2]!.accessToken)).toBe('otro-en-claro');
  });

  it('es idempotente: una segunda corrida no cambia nada', async () => {
    await encryptChannelTokens(db as never, cipher);
    const before = JSON.stringify(rows);
    const second = await encryptChannelTokens(db as never, cipher);
    expect(second).toEqual({ scanned: 3, updated: 0, skipped: 3 });
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('DRY_RUN informa pero no escribe', async () => {
    const report = await encryptChannelTokens(db as never, cipher, true);
    expect(report.updated).toBe(2);
    expect(db.channelAccount.update).not.toHaveBeenCalled();
    expect(rows[0]!.accessToken).toBe('token-en-claro');
  });

  it('sin clave configurada se niega a correr (no "cifra" sin cifrar)', async () => {
    await expect(
      encryptChannelTokens(db as never, TokenCipher.fromEnv({})),
    ).rejects.toThrow(/CHANNEL_TOKEN_ENCRYPTION_KEY/);
  });
});
