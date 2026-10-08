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
    serializers: {
      req(req: IncomingMessage & { id?: unknown }) {
        return {
          method:    req.method,
          url:       req.url,
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
