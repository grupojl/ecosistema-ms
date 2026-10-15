import { ForbiddenException } from '@nestjs/common';
import { EcosystemController } from '@/modules/common/ecosystem/ecosystem.controller.js';

describe('EcosystemController — clave de plataforma', () => {
  const KEY = 'clave-de-plataforma-segura';
  const svc = {
    register: jest.fn().mockResolvedValue({ success: true }),
    findAll: jest.fn().mockResolvedValue([]),
    updateConfig: jest.fn().mockResolvedValue({}),
    deactivate: jest.fn().mockResolvedValue({}),
  };
  let ctl: EcosystemController;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['PLATFORM_ADMIN_KEY'] = KEY;
    ctl = new EcosystemController(svc as never);
  });
  afterEach(() => delete process.env['PLATFORM_ADMIN_KEY']);

  // Cada método debe validar la clave ANTES de tocar el service (no hay guard de clase: se valida adentro)
  const calls: Array<[string, (key: string) => unknown, jest.Mock]> = [
    [
      'register',
      (k) =>
        ctl.register(k, {
          firebaseProjectId: 'fb',
          name: 'x',
          config: {},
        } as never),
      svc.register,
    ],
    ['findAll', (k) => ctl.findAll(k), svc.findAll],
    [
      'updateConfig',
      (k) => ctl.updateConfig(k, 'eco-1', { plan: 'x' } as never),
      svc.updateConfig,
    ],
    ['deactivate', (k) => ctl.deactivate(k, 'eco-1'), svc.deactivate],
  ];

  it.each(calls)(
    '%s rechaza sin clave o con clave incorrecta y no toca el service',
    (_name, call, spy) => {
      expect(() => call(undefined as never)).toThrow(ForbiddenException);
      expect(() => call('incorrecta')).toThrow(ForbiddenException);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each(calls)(
    '%s funciona con la clave correcta',
    async (_name, call, spy) => {
      await call(KEY);
      expect(spy).toHaveBeenCalledTimes(1);
    },
  );

  it('si PLATFORM_ADMIN_KEY no está configurada NADIE entra (ni con clave vacía)', () => {
    delete process.env['PLATFORM_ADMIN_KEY'];
    expect(() => ctl.findAll('')).toThrow(ForbiddenException);
    expect(() => ctl.findAll(undefined as never)).toThrow(ForbiddenException);
    expect(svc.findAll).not.toHaveBeenCalled();
  });
});
