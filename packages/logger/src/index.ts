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
      req(req: Record<string, unknown>) {
        return {
          method:    req['method'],
          url:       req['url'],
          requestId: req['id'],
        };
      },
    },
    customProps(req: Record<string, unknown>) {
      return {
        service:     process.env['SERVICE_NAME'] ?? 'ecosistema-ms',
        requestId:   (req['headers'] as Record<string, string>)?.['x-request-id'],
        ecosystemId: (req['headers'] as Record<string, string>)?.['x-ecosystem-id'],
      };
    },
  },
};

export function createLoggerModule() {
  return LoggerModule.forRoot(pinoParams);
}

export { LoggerModule } from 'nestjs-pino';
