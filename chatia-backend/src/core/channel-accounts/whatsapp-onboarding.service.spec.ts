import { randomBytes } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import { GraphApiError } from '@/core/channel-accounts/whatsapp-graph.port.js';
import { WhatsAppOnboardingService } from '@/core/channel-accounts/whatsapp-onboarding.service.js';

const DTO = {
  code: 'code-1',
  wabaId: '1370479218232935',
  phoneNumberId: '1431511583371503',
};
const PHONE = {
  id: DTO.phoneNumberId,
  displayPhoneNumber: '+54 383 511-7701',
  verifiedName: 'Muni',
  status: 'CONNECTED',
};

describe('WhatsAppOnboardingService', () => {
  const repo = {
    create: jest.fn(),
    update: jest.fn(),
    findOwned: jest.fn(),
    findByChannel: jest.fn(),
    listByOrganization: jest.fn(),
  };
  const graph = {
    appCredentials: jest.fn(),
    exchangeCode: jest.fn(),
    listPhoneNumbers: jest.fn(),
    subscribeApp: jest.fn(),
    listSubscribedAppIds: jest.fn(),
    registerPhone: jest.fn(),
    unsubscribeApp: jest.fn(),
  };
  let cipher: TokenCipher;
  let svc: WhatsAppOnboardingService;

  beforeEach(() => {
    jest.resetAllMocks();
    cipher = TokenCipher.fromEnv({
      CHANNEL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    });
    svc = new WhatsAppOnboardingService(repo as never, cipher, graph as never);
    graph.appCredentials.mockReturnValue({ appId: 'app-1', appSecret: 's' });
    graph.exchangeCode.mockResolvedValue('TOKEN-CLIENTE');
    graph.listPhoneNumbers.mockResolvedValue([PHONE]);
    graph.subscribeApp.mockResolvedValue(undefined);
    graph.listSubscribedAppIds.mockResolvedValue(['app-1']);
    graph.registerPhone.mockResolvedValue(undefined);
    graph.unsubscribeApp.mockResolvedValue(undefined);
    repo.findByChannel.mockResolvedValue(null);
    repo.create.mockImplementation((d: Record<string, unknown>) => ({
      id: 'acc-1',
      isActive: true,
      ...d,
    }));
  });

  describe('connect', () => {
    it('crea la cuenta de la organización con el token cifrado y sin exponerlo', async () => {
      const res = await svc.connect('org-1', 'OWNER', DTO);

      const created = repo.create.mock.calls[0][0];
      expect(created).toMatchObject({
        organizationId: 'org-1',
        channelType: 'WHATSAPP',
        externalId: DTO.phoneNumberId,
        name: 'Muni',
      });
      expect(created.accessToken).not.toContain('TOKEN-CLIENTE');
      expect(cipher.decrypt(created.accessToken)).toBe('TOKEN-CLIENTE');
      expect(graph.subscribeApp).toHaveBeenCalledWith(
        DTO.wabaId,
        'TOKEN-CLIENTE',
      );

      expect(res.data.subscribed).toBe(true);
      expect(res.data.registered).toBe(true);
      expect(res.data.webhookUrl.endsWith('/api/v1/webhooks/whatsapp')).toBe(
        true,
      );
      expect(JSON.stringify(res)).not.toContain('TOKEN-CLIENTE');
      expect(res.data).not.toHaveProperty('accessToken');
    });

    it('un MEMBER o VIEWER no puede conectar (y no llama a Meta)', async () => {
      await expect(svc.connect('org-1', 'MEMBER', DTO)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(svc.connect('org-1', 'VIEWER', DTO)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(graph.exchangeCode).not.toHaveBeenCalled();
    });

    it('503 si la plataforma no tiene la app de Meta configurada', async () => {
      graph.appCredentials.mockReturnValue(null);
      await expect(svc.connect('org-1', 'ADMIN', DTO)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('400 si el número no pertenece a la WABA indicada (no confía en el body)', async () => {
      graph.listPhoneNumbers.mockResolvedValue([{ ...PHONE, id: '999999' }]);
      await expect(svc.connect('org-1', 'OWNER', DTO)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(graph.subscribeApp).not.toHaveBeenCalled();
    });

    it('409 si el número ya está conectado a OTRA organización', async () => {
      repo.findByChannel.mockResolvedValue({
        id: 'acc-x',
        organizationId: 'org-2',
      });
      await expect(svc.connect('org-1', 'OWNER', DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
      expect(graph.subscribeApp).not.toHaveBeenCalled();
    });

    it('reconectar un número de la misma organización actualiza el token en vez de duplicar', async () => {
      repo.findByChannel.mockResolvedValue({
        id: 'acc-1',
        organizationId: 'org-1',
      });
      repo.update.mockImplementation(
        (id: string, d: Record<string, unknown>) => ({
          id,
          organizationId: 'org-1',
          ...d,
        }),
      );
      await svc.connect('org-1', 'OWNER', DTO);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        'acc-1',
        expect.objectContaining({ accessToken: expect.any(String) }),
      );
    });

    it('502 y sin cuenta creada si Meta no confirma la suscripción a la app', async () => {
      graph.listSubscribedAppIds.mockResolvedValue(['otra-app']);
      await expect(svc.connect('org-1', 'OWNER', DTO)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('si el registro del número falla, el alta igual se completa e informa registered=false', async () => {
      graph.registerPhone.mockRejectedValue(
        new GraphApiError(400, 100, 'ya registrado'),
      );
      const res = await svc.connect('org-1', 'OWNER', DTO);
      expect(res.data.registered).toBe(false);
      expect(repo.create).toHaveBeenCalled();
    });

    it('un código rechazado por Meta se traduce a 400 sin filtrar el detalle', async () => {
      graph.exchangeCode.mockRejectedValue(
        new GraphApiError(400, 100, 'This authorization code has been used'),
      );
      const err = await svc
        .connect('org-1', 'OWNER', DTO)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).not.toContain('authorization code');
    });

    it('una caída de Meta se traduce a 502', async () => {
      graph.exchangeCode.mockRejectedValue(
        new GraphApiError(0, undefined, 'timeout'),
      );
      await expect(svc.connect('org-1', 'OWNER', DTO)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });

  describe('status', () => {
    const account = () => ({
      id: 'acc-1',
      organizationId: 'org-1',
      channelType: 'WHATSAPP',
      externalId: DTO.phoneNumberId,
      accessToken: cipher.encrypt('TOKEN-CLIENTE'),
      extraConfig: cipher.encryptExtraConfig({ wabaId: DTO.wabaId }),
    });

    it('consulta solo cuentas de la organización: otra org recibe 404', async () => {
      repo.findOwned.mockResolvedValue(null);
      await expect(svc.status('acc-1', 'org-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findOwned).toHaveBeenCalledWith('acc-1', 'org-2');
    });

    it('connected=true con token vigente y WABA suscrita', async () => {
      repo.findOwned.mockResolvedValue(account());
      const res = await svc.status('acc-1', 'org-1');
      expect(res.data).toMatchObject({ connected: true, subscribed: true });
    });

    it('connected=false si falta la suscripción a la app', async () => {
      repo.findOwned.mockResolvedValue(account());
      graph.listSubscribedAppIds.mockResolvedValue([]);
      const res = await svc.status('acc-1', 'org-1');
      expect(res.data).toMatchObject({ connected: false, subscribed: false });
    });

    it('token vencido (190) → connected=false pidiendo reconectar', async () => {
      repo.findOwned.mockResolvedValue(account());
      graph.listPhoneNumbers.mockRejectedValue(
        new GraphApiError(401, 190, 'expired'),
      );
      const res = await svc.status('acc-1', 'org-1');
      expect(res.data).toMatchObject({ connected: false });
      expect((res.data as { reason: string }).reason).toContain('reconectar');
    });
  });

  describe('current y disconnect', () => {
    const account = (over: Record<string, unknown> = {}) => ({
      id: 'acc-1',
      organizationId: 'org-1',
      channelType: 'WHATSAPP',
      isActive: true,
      externalId: DTO.phoneNumberId,
      accessToken: cipher.encrypt('TOKEN-CLIENTE'),
      extraConfig: cipher.encryptExtraConfig({
        wabaId: DTO.wabaId,
        displayPhoneNumber: PHONE.displayPhoneNumber,
      }),
      ...over,
    });

    it('current: sin WhatsApp activo devuelve data null', async () => {
      repo.listByOrganization.mockResolvedValue([
        account({ isActive: false }),
        account({ id: 'ig', channelType: 'INSTAGRAM' }),
      ]);
      const res = await svc.current('org-1');
      expect(res.data).toBeNull();
    });

    it('current: devuelve cuenta, número y estado, sin token', async () => {
      repo.listByOrganization.mockResolvedValue([account()]);
      repo.findOwned.mockResolvedValue(account());
      const res = await svc.current('org-1');
      expect(res.data).toMatchObject({
        accountId: 'acc-1',
        displayPhoneNumber: PHONE.displayPhoneNumber,
        connected: true,
      });
      expect(JSON.stringify(res)).not.toContain('TOKEN-CLIENTE');
    });

    it('disconnect: quita la suscripción, desactiva y descarta el token', async () => {
      repo.findOwned.mockResolvedValue(account());
      await svc.disconnect('acc-1', 'org-1');
      expect(graph.unsubscribeApp).toHaveBeenCalledWith(
        DTO.wabaId,
        'TOKEN-CLIENTE',
      );
      const patch = repo.update.mock.calls[0][1];
      expect(patch.isActive).toBe(false);
      expect(cipher.decrypt(patch.accessToken)).toBe('disconnected');
    });

    it('disconnect: si Meta falla igual desactiva la cuenta', async () => {
      repo.findOwned.mockResolvedValue(account());
      graph.unsubscribeApp.mockRejectedValue(
        new GraphApiError(401, 190, 'expired'),
      );
      await svc.disconnect('acc-1', 'org-1');
      expect(repo.update.mock.calls[0][1].isActive).toBe(false);
    });

    it('disconnect: otra organización recibe 404 y no toca nada', async () => {
      repo.findOwned.mockResolvedValue(null);
      await expect(svc.disconnect('acc-1', 'org-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
