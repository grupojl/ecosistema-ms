import { UnauthorizedException } from '@nestjs/common';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';

describe('WidgetSessionService', () => {
  let svc: WidgetSessionService;

  beforeEach(() => {
    process.env['WIDGET_SESSION_SECRET'] = 's'.repeat(40);
    process.env['NODE_ENV'] = 'test';
    svc = new WidgetSessionService();
  });

  afterEach(() => {
    delete process.env['WIDGET_SESSION_SECRET'];
    delete process.env['WIDGET_SESSION_TTL_HOURS'];
  });

  it('emite un token que verifica para el mismo proyecto y organización', () => {
    const issued = svc.issue('tramites', 'org-1');
    expect(svc.verify(issued.token, 'tramites', 'org-1')).toBe(
      issued.sessionId,
    );
  });

  it('cada sesión tiene un id distinto y no adivinable', () => {
    expect(svc.issue('p', 'o').sessionId).not.toBe(
      svc.issue('p', 'o').sessionId,
    );
  });

  it('rechaza un token de otro proyecto u otra organización (aislamiento entre tenants)', () => {
    const { token } = svc.issue('tramites', 'org-1');
    expect(() => svc.verify(token, 'otro-proyecto', 'org-1')).toThrow(
      UnauthorizedException,
    );
    expect(() => svc.verify(token, 'tramites', 'org-2')).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token vencido', () => {
    process.env['WIDGET_SESSION_TTL_HOURS'] = '1';
    const t0 = Date.now();
    const { token } = svc.issue('p', 'o', t0);
    expect(() => svc.verify(token, 'p', 'o', t0 + 2 * 3600 * 1000)).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza tokens manipulados, vacíos o con formato inválido', () => {
    const { token } = svc.issue('p', 'o');
    const [v, body, sig] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({
        sid: 'otra-sesion',
        slug: 'p',
        org: 'o',
        exp: 9999999999,
      }),
    ).toString('base64url');
    expect(() => svc.verify(`${v}.${forgedBody}.${sig}`, 'p', 'o')).toThrow(
      UnauthorizedException,
    );
    expect(() => svc.verify(`${v}.${body}.firma-falsa`, 'p', 'o')).toThrow(
      UnauthorizedException,
    );
    expect(() => svc.verify(undefined, 'p', 'o')).toThrow(
      UnauthorizedException,
    );
    expect(() => svc.verify('basura', 'p', 'o')).toThrow(UnauthorizedException);
    expect(() => svc.verify('v2.a.b', 'p', 'o')).toThrow(UnauthorizedException);
  });

  it('un token firmado con otro secreto no sirve', () => {
    const { token } = svc.issue('p', 'o');
    process.env['WIDGET_SESSION_SECRET'] = 'x'.repeat(40);
    expect(() => svc.verify(token, 'p', 'o')).toThrow(UnauthorizedException);
  });

  it('en producción exige WIDGET_SESSION_SECRET', () => {
    delete process.env['WIDGET_SESSION_SECRET'];
    process.env['NODE_ENV'] = 'production';
    expect(() => new WidgetSessionService().issue('p', 'o')).toThrow(
      /WIDGET_SESSION_SECRET/,
    );
    process.env['NODE_ENV'] = 'test';
  });
});
