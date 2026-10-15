import type { DynamicModule } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import { LoggerModule } from 'nestjs-pino';
import type { Params } from 'nestjs-pino';

const isDev = process.env['NODE_ENV'] !== 'production';

const pinoParams: Params = {
  pinoHttp: {
    level: process.env['LOG_LEVEL'] ?? (isDev ? 'debug' : 'info'),
    transport: isDev
      ? { target: 'pino-pretty', options: { colorize: true, singleLine: false } }
      : undefined,
    // Datos sensibles nunca deben llegar a los logs (si algún día se serializan headers o cuerpos)
    redact: {
      paths: [
        'req.headers.authorization', 'req.headers.cookie',
        'req.headers["x-hub-signature-256"]', 'req.headers["x-tiktok-signature"]',
        'req.headers["x-widget-token"]', 'req.headers["x-internal-api-key"]',
        'req.headers["x-platform-admin-key"]', 'req.headers["x-api-key"]',
        'res.headers["set-cookie"]',
        '*.password', '*.accessToken', '*.apiKey', '*.privateKey', '*.token',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req(req: IncomingMessage & { id?: unknown }) {
        return {
          method:    req.method,
          // Sin query string: puede traer hub.verify_token u otros secretos
          url:       req.url?.split('?')[0],
          requestId: req.id,
        };
      },
    },
    customProps(req: IncomingMessage) {
      return {
        service:     process.env['SERVICE_NAME'] ?? 'ecosistema-ms',
        requestId:   req.headers['x-request-id'],
        ecosystemId: req.headers['x-ecosystem-id'],
      };
    },
  },
};

export function createLoggerModule(): DynamicModule {
  return LoggerModule.forRoot(pinoParams);
}

export { LoggerModule } from 'nestjs-pino';
