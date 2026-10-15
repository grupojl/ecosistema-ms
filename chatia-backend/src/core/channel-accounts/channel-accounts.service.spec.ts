import { randomBytes } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import {
  ChannelAccountsService,
  toPublicAccount,
} from '@/core/channel-accounts/channel-accounts.service.js';

const stored = {
  id: 'acc-1',
  organizationId: 'org-1',
  channelType: 'WHATSAPP',
  name: 'Muni',
  externalId: 'pn-1',
  accessToken: 'EAAG-super-secreto',
  webhookVerifyToken: 'verify-1',
  extraConfig: { appSecret: 'app-secret-privado', wabaId: '123' },
};

describe('ChannelAccountsService — secretos', () => {
  const repo = {
    create: jest.fn(),
    listByOrganization: jest.fn(),
    findOwned: jest.fn(),
    update: jest.fn(),
  };
  let svc: ChannelAccountsService;
  let cipher: TokenCipher;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['APP_URL'] = 'https://chatia.example.com';
    cipher = TokenCipher.fromEnv({
      CHANNEL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    });
    svc = new ChannelAccountsService(repo as never, cipher);
  });

  afterEach(() => {
    delete process.env['APP_URL'];
  });

  const leaks = (value: unknown): boolean => {
    const json = JSON.stringify(value);
    return (
      json.includes('EAAG-super-secreto') || json.includes('app-secret-privado')
    );
  };

  it('toPublicAccount quita accessToken y appSecret, e informa si existen', () => {
    const pub = toPublicAccount(stored);
    expect(pub).not.toHaveProperty('accessToken');
    expect(pub.extraConfig).toEqual({ wabaId: '123' });
    expect(pub).toMatchObject({ hasAccessToken: true, hasAppSecret: true });
    expect(leaks(pub)).toBe(false);
  });

  it('create/list/findOne/update NUNCA devuelven el accessToken ni el appSecret', async () => {
    repo.create.mockResolvedValue(stored);
    repo.listByOrganization.mockResolvedValue([stored]);
    repo.findOwned.mockResolvedValue(stored);
    repo.update.mockResolvedValue(stored);

    const created = await svc.create('org-1', {
      channelType: 'WHATSAPP',
      name: 'Muni',
      externalId: 'pn-1',
      accessToken: 'x',
      extraConfig: {},
    });
    expect(leaks(created)).toBe(false);
    expect(leaks(await svc.list('org-1'))).toBe(false);
    expect(leaks(await svc.findOne('acc-1', 'org-1'))).toBe(false);
    expect(leaks(await svc.update('acc-1', 'org-1', { name: 'Nuevo' }))).toBe(
      false,
    );
  });

  it('la URL de webhook apunta a una ruta que existe (api/v1/webhooks/<canal>/<externalId>)', async () => {
    repo.create.mockResolvedValue(stored);
    const res = await svc.create('org-1', {
      channelType: 'WHATSAPP',
      name: 'x',
      externalId: 'pn-1',
      accessToken: 'x',
      extraConfig: {},
    });
    expect(res.data.webhookUrl).toBe(
      'https://chatia.example.com/api/v1/webhooks/whatsapp/pn-1',
    );
  });

  it('editar extraConfig sin reenviar appSecret conserva el existente (el cliente nunca lo recibe)', async () => {
    const encryptedStored = {
      ...stored,
      extraConfig: {
        appSecret: cipher.encrypt('app-secret-privado'),
        wabaId: '123',
      },
    };
    repo.findOwned.mockResolvedValue(encryptedStored);
    repo.update.mockResolvedValue(encryptedStored);
    await svc.update('acc-1', 'org-1', { extraConfig: { wabaId: '999' } });
    const saved = repo.update.mock.calls[0]![1].extraConfig as Record<
      string,
      string
    >;
    expect(saved['wabaId']).toBe('999');
    expect(cipher.decrypt(saved['appSecret']!)).toBe('app-secret-privado'); // conservado y todavía cifrado
  });

  it('si el cliente envía un appSecret nuevo, se reemplaza (cifrado)', async () => {
    repo.findOwned.mockResolvedValue(stored);
    repo.update.mockResolvedValue(stored);
    await svc.update('acc-1', 'org-1', { extraConfig: { appSecret: 'nuevo' } });
    const saved = repo.update.mock.calls[0]![1].extraConfig as Record<
      string,
      string
    >;
    expect(saved['appSecret']).toMatch(/^enc:v1:/);
    expect(cipher.decrypt(saved['appSecret']!)).toBe('nuevo');
  });

  it('actualizar el accessToken lo guarda cifrado', async () => {
    repo.findOwned.mockResolvedValue(stored);
    repo.update.mockResolvedValue(stored);
    await svc.update('acc-1', 'org-1', { accessToken: 'EAAG-nuevo' });
    const saved = repo.update.mock.calls[0]![1].accessToken as string;
    expect(saved).not.toBe('EAAG-nuevo');
    expect(cipher.decrypt(saved)).toBe('EAAG-nuevo');
  });

  it('CIFRADO EN REPOSO: lo que se guarda en la base no contiene el token ni el appSecret en claro', async () => {
    repo.create.mockResolvedValue(stored);
    await svc.create('org-1', {
      channelType: 'WHATSAPP',
      name: 'x',
      externalId: 'pn-1',
      accessToken: 'EAAG-en-claro',
      extraConfig: { appSecret: 'secreto-en-claro' },
    });
    const data = repo.create.mock.calls[0]![0] as {
      accessToken: string;
      extraConfig: Record<string, string>;
    };
    expect(JSON.stringify(data)).not.toMatch(/EAAG-en-claro|secreto-en-claro/);
    expect(cipher.decrypt(data.accessToken)).toBe('EAAG-en-claro');
    expect(cipher.decrypt(data.extraConfig['appSecret']!)).toBe(
      'secreto-en-claro',
    );
  });

  it('rotateToken genera un verify token nuevo y lo devuelve', async () => {
    repo.findOwned.mockResolvedValue(stored);
    repo.update.mockImplementation(
      (_id: string, data: { webhookVerifyToken: string }) => ({
        ...stored,
        webhookVerifyToken: data.webhookVerifyToken,
      }),
    );
    const res = await svc.rotateToken('acc-1', 'org-1');
    expect(res.data.webhookVerifyToken).toBeTruthy();
    expect(res.data.webhookVerifyToken).not.toBe('verify-1');
  });

  it('operaciones de otra organización → 404 (aislamiento)', async () => {
    repo.findOwned.mockResolvedValue(null);
    await expect(svc.findOne('acc-1', 'org-OTRA')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      svc.update('acc-1', 'org-OTRA', { name: 'x' }),
    ).rejects.toThrow(NotFoundException);
    await expect(svc.rotateToken('acc-1', 'org-OTRA')).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.findOwned).toHaveBeenCalledWith('acc-1', 'org-OTRA');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
