// src/core/widget/widget-session.service.ts
//
// Token de sesión del widget, firmado por el servidor (HMAC-SHA256). Reemplaza al `userId` que antes
// mandaba el cliente: el visitante no puede elegir ni adivinar la sesión de otro.
// Formato: v1.<payload base64url>.<firma base64url>   payload = { sid, slug, org, exp }
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

const DEFAULT_TTL_HOURS = 24 * 7;

interface TokenPayload {
  sid: string;
  slug: string;
  org: string;
  exp: number; // epoch seconds
}

export interface IssuedWidgetSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

@Injectable()
export class WidgetSessionService {
  private readonly logger = new Logger(WidgetSessionService.name);
  private readonly devSecret = randomBytes(32).toString('hex');

  issue(
    slug: string,
    organizationId: string,
    now = Date.now(),
  ): IssuedWidgetSession {
    const ttlHours = Number(
      process.env['WIDGET_SESSION_TTL_HOURS'] ?? DEFAULT_TTL_HOURS,
    );
    const exp = Math.floor(now / 1000) + Math.round(ttlHours * 3600);
    const payload: TokenPayload = {
      sid: randomUUID(),
      slug,
      org: organizationId,
      exp,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return {
      token: `v1.${body}.${this.sign(body)}`,
      sessionId: payload.sid,
      expiresAt: new Date(exp * 1000),
    };
  }

  /** Devuelve el sessionId si el token es válido para ESTE proyecto y organización. */
  verify(
    token: string | undefined,
    slug: string,
    organizationId: string,
    now = Date.now(),
  ): string {
    const invalid = (): never => {
      throw new UnauthorizedException('Sesión del widget inválida o vencida');
    };
    if (!token) return invalid();

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return invalid();
    const [, body, signature] = parts as [string, string, string];

    const expected = Buffer.from(this.sign(body));
    const received = Buffer.from(signature);
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      return invalid();

    let payload: TokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as TokenPayload;
    } catch {
      return invalid();
    }

    if (payload.slug !== slug || payload.org !== organizationId)
      return invalid();
    if (!payload.sid || payload.exp * 1000 <= now) return invalid();
    return payload.sid;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret()).update(body).digest('base64url');
  }

  private secret(): string {
    const configured = process.env['WIDGET_SESSION_SECRET'];
    if (configured) return configured;
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('WIDGET_SESSION_SECRET es obligatorio en producción');
    }
    this.logger.warn(
      'WIDGET_SESSION_SECRET no definido — secreto efímero de desarrollo',
    );
    return this.devSecret;
  }
}
