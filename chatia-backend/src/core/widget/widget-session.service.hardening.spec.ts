// Endurecimiento del token de sesión del widget: cada caso mata un mutante que los tests anteriores dejaban vivir
// (TTL por defecto, borde exacto de vencimiento, formato estricto, payload corrupto firmado, secreto de desarrollo).
import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';

const SECRET = 's'.repeat(40);
const signed = (payload: unknown, secret = SECRET): string => {
  const body = Buffer.from(
    typeof payload === 'string' ? payload : JSON.stringify(payload),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `v1.${body}.${sig}`;
};

describe('WidgetSessionService — endurecimiento', () => {
  let svc: WidgetSessionService;
  const T0 = 1_800_000_000_000; // ms, múltiplo de 1000

  beforeEach(() => {
    process.env['WIDGET_SESSION_SECRET'] = SECRET;
    process.env['NODE_ENV'] = 'test';
    delete process.env['WIDGET_SESSION_TTL_HOURS'];
    svc = new WidgetSessionService();
  });
  afterEach(() => {
    delete process.env['WIDGET_SESSION_SECRET'];
    delete process.env['WIDGET_SESSION_TTL_HOURS'];
    process.env['NODE_ENV'] = 'test';
  });

  describe('vigencia', () => {
    it('por defecto la sesión dura exactamente 7 días', () => {
      const { expiresAt } = svc.issue('p', 'o', T0);
      expect(expiresAt.getTime()).toBe(T0 + 7 * 24 * 3600 * 1000);
    });

    it('WIDGET_SESSION_TTL_HOURS cambia la duración (y expiresAt está en milisegundos)', () => {
      process.env['WIDGET_SESSION_TTL_HOURS'] = '2';
      expect(svc.issue('p', 'o', T0).expiresAt.getTime()).toBe(
        T0 + 2 * 3600 * 1000,
      );
    });

    it('el borde es exacto: válido un milisegundo antes del vencimiento, inválido justo en él', () => {
      const { token, expiresAt } = svc.issue('p', 'o', T0);
      const exp = expiresAt.getTime();
      expect(() => svc.verify(token, 'p', 'o', exp - 1)).not.toThrow();
      expect(() => svc.verify(token, 'p', 'o', exp)).toThrow(
        UnauthorizedException,
      );
      expect(() => svc.verify(token, 'p', 'o', exp + 1)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('formato estricto', () => {
    const base = () => svc.issue('p', 'o').token;

    it('un prefijo de versión distinto se rechaza AUNQUE la firma sea válida', () => {
      const [, body, sig] = base().split('.');
      expect(() => svc.verify(`v2.${body}.${sig}`, 'p', 'o')).toThrow(
        UnauthorizedException,
      );
      expect(() => svc.verify(`.${body}.${sig}`, 'p', 'o')).toThrow(
        UnauthorizedException,
      );
    });

    it('partes de más o de menos se rechazan AUNQUE las tres primeras sean válidas', () => {
      const t = base();
      expect(() => svc.verify(`${t}.extra`, 'p', 'o')).toThrow(
        UnauthorizedException,
      );
      const [v, body] = t.split('.');
      expect(() => svc.verify(`${v}.${body}`, 'p', 'o')).toThrow(
        UnauthorizedException,
      );
    });

    it('todo rechazo usa el mismo mensaje (no revela por qué falló)', () => {
      const t = base();
      const [v, body, sig] = t.split('.');
      const msgs = [
        undefined,
        '',
        'basura',
        `v2.${body}.${sig}`,
        `${v}.${body}.mala`,
        signed('{no es json'),
        signed({ slug: 'p', org: 'o', exp: 9999999999 }), // sin sid
        signed({ sid: 'a', slug: 'otro', org: 'o', exp: 9999999999 }),
        signed({ sid: 'a', slug: 'p', org: 'otra', exp: 9999999999 }),
      ].map((x) => {
        try {
          svc.verify(x, 'p', 'o');
          return 'NO LANZÓ';
        } catch (e) {
          return (e as Error).message;
        }
      });
      expect(new Set(msgs)).toEqual(
        new Set(['Sesión del widget inválida o vencida']),
      );
    });
  });

  describe('payload firmado pero corrupto', () => {
    it('un cuerpo que no es JSON (con firma válida) se rechaza sin romper', () => {
      expect(() => svc.verify(signed('{no es json'), 'p', 'o')).toThrow(
        UnauthorizedException,
      );
    });

    it('un payload sin sid se rechaza', () => {
      const t = signed({ slug: 'p', org: 'o', exp: 9999999999 });
      expect(() => svc.verify(t, 'p', 'o', T0)).toThrow(UnauthorizedException);
    });

    it('un payload bien formado y firmado a mano SÍ es válido (control positivo)', () => {
      const t = signed({ sid: 'sid-1', slug: 'p', org: 'o', exp: 9999999999 });
      expect(svc.verify(t, 'p', 'o', T0)).toBe('sid-1');
    });
  });

  describe('secreto de desarrollo', () => {
    it('fuera de producción y sin WIDGET_SESSION_SECRET usa un secreto efímero y avisa', () => {
      delete process.env['WIDGET_SESSION_SECRET'];
      const a = new WidgetSessionService();
      const warn = jest
        .spyOn(
          (a as unknown as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      const { token, sessionId } = a.issue('p', 'o');
      expect(a.verify(token, 'p', 'o')).toBe(sessionId);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('WIDGET_SESSION_SECRET no definido'),
      );
    });

    it('el secreto efímero es distinto por instancia: el token de una no sirve en otra', () => {
      delete process.env['WIDGET_SESSION_SECRET'];
      const a = new WidgetSessionService();
      const b = new WidgetSessionService();
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { token } = a.issue('p', 'o');
      expect(() => b.verify(token, 'p', 'o')).toThrow(UnauthorizedException);
    });

    it('en producción CON secreto configurado funciona (el error es solo si falta)', () => {
      process.env['NODE_ENV'] = 'production';
      const { token, sessionId } = svc.issue('p', 'o');
      expect(svc.verify(token, 'p', 'o')).toBe(sessionId);
    });
  });
});
