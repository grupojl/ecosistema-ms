// fetchUrlText: la descarga real (redirecciones, tamaño, timeout, tipo) con http/https y DNS simulados — sin red.
import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {
  fetchUrlText,
  UnsafeUrlError,
} from '@/core/faq/ingestion/safe-url-fetch.js';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:http', () => ({
  __esModule: true,
  default: { request: jest.fn() },
}));
jest.mock('node:https', () => ({
  __esModule: true,
  default: { request: jest.fn() },
}));

const PUBLIC = [{ address: '93.184.216.34', family: 4 }];

interface FakeReply {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
  timeout?: boolean;
}

/** Programa respuestas sucesivas del "servidor" (una por salto de redirección). */
function serve(replies: FakeReply[]): jest.Mock {
  let i = 0;
  const impl = jest.fn(
    (
      _url: URL,
      _opts: unknown,
      cb: (
        res: EventEmitter & { statusCode?: number; headers: object },
      ) => void,
    ) => {
      const reply = replies[Math.min(i++, replies.length - 1)]!;
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (e?: Error) => void;
      };
      let destroyed = false;
      req.destroy = (e?: Error) => {
        destroyed = true; // como en http real: una petición destruida ya no entrega más datos ni 'end'
        if (e) setImmediate(() => req.emit('error', e));
      };
      req.end = () => {
        setImmediate(() => {
          if (reply.timeout) return req.emit('timeout');
          const res = new EventEmitter() as EventEmitter & {
            statusCode?: number;
            headers: object;
          };
          res.statusCode = reply.status ?? 200;
          res.headers = reply.headers ?? {};
          cb(res);
          for (const c of reply.chunks ?? []) {
            if (destroyed) return;
            res.emit('data', c);
          }
          if (!destroyed) res.emit('end');
        });
      };
      return req;
    },
  );
  (https.request as unknown as jest.Mock).mockImplementation(impl);
  (http.request as unknown as jest.Mock).mockImplementation(impl);
  return impl;
}

const html = (body: string): FakeReply => ({
  headers: { 'content-type': 'text/html; charset=utf-8' },
  chunks: [Buffer.from(body)],
});

describe('fetchUrlText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (lookup as unknown as jest.Mock).mockResolvedValue(PUBLIC);
  });

  it('descarga HTML y lo convierte a texto plano', async () => {
    serve([
      html(
        '<html><head><title>x</title></head><body><p>Horario: 8 a 14</p><script>evil()</script></body></html>',
      ),
    ]);
    const text = await fetchUrlText('https://muni.example.com/horarios');
    expect(text).toContain('Horario: 8 a 14');
    expect(text).not.toContain('evil');
    expect(text).not.toContain('<p>');
  });

  it('el texto plano y el JSON se devuelven tal cual (recortados)', async () => {
    serve([
      {
        headers: { 'content-type': 'text/plain' },
        chunks: [Buffer.from('  hola  ')],
      },
    ]);
    expect(await fetchUrlText('https://x.example.com/a')).toBe('hola');
    serve([
      {
        headers: { 'content-type': 'application/json' },
        chunks: [Buffer.from('{"a":1}')],
      },
    ]);
    expect(await fetchUrlText('https://x.example.com/b')).toBe('{"a":1}');
  });

  it('la conexión queda FIJADA a la IP ya validada (anti DNS-rebinding)', async () => {
    const request = serve([html('<p>ok</p>')]);
    await fetchUrlText('https://muni.example.com/');
    const opts = request.mock.calls[0]![1] as {
      lookup: (
        h: string,
        o: unknown,
        cb: (e: null, a: string, f: number) => void,
      ) => void;
    };
    const cb = jest.fn();
    opts.lookup('muni.example.com', {}, cb);
    expect(cb).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });

  it('usa http para http:// y https para https://', async () => {
    serve([html('<p>ok</p>')]);
    await fetchUrlText('http://x.example.com/');
    expect(http.request).toHaveBeenCalled();
    expect(https.request).not.toHaveBeenCalled();
  });

  it('sigue una redirección a otro sitio público', async () => {
    const request = serve([
      { status: 302, headers: { location: '/nueva' } },
      html('<p>destino</p>'),
    ]);
    expect(await fetchUrlText('https://x.example.com/vieja')).toContain(
      'destino',
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect((request.mock.calls[1]![0] as URL).pathname).toBe('/nueva');
  });

  it('RECHAZA una redirección hacia una IP privada (SSRF por redirect)', async () => {
    serve([
      {
        status: 301,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      },
    ]);
    await expect(fetchUrlText('https://x.example.com/')).rejects.toThrow(
      /dirección no permitida/,
    );
  });

  it('RECHAZA un dominio que resuelve a una IP privada', async () => {
    (lookup as unknown as jest.Mock).mockResolvedValue([
      { address: '10.0.0.5', family: 4 },
    ]);
    serve([html('<p>x</p>')]);
    await expect(
      fetchUrlText('https://interno.example.com/'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('corta una cadena de redirecciones infinita', async () => {
    serve([{ status: 302, headers: { location: '/otra' } }]);
    await expect(fetchUrlText('https://x.example.com/')).rejects.toThrow(
      'Demasiadas redirecciones',
    );
  });

  it('un status de error o un tipo de contenido no soportado se rechazan con mensaje claro', async () => {
    serve([{ status: 404, headers: { 'content-type': 'text/html' } }]);
    await expect(fetchUrlText('https://x.example.com/')).rejects.toThrow(
      'respondió 404',
    );
    serve([
      { headers: { 'content-type': 'image/png' }, chunks: [Buffer.from('x')] },
    ]);
    await expect(fetchUrlText('https://x.example.com/')).rejects.toThrow(
      /Tipo de contenido no soportado/,
    );
    serve([{ chunks: [Buffer.from('x')] }]);
    await expect(fetchUrlText('https://x.example.com/')).rejects.toThrow(
      /desconocido/,
    );
  });

  it('corta documentos de más de 2 MB', async () => {
    serve([
      {
        headers: { 'content-type': 'text/html' },
        chunks: [
          Buffer.alloc(1024 * 1024),
          Buffer.alloc(1024 * 1024),
          Buffer.alloc(10),
        ],
      },
    ]);
    await expect(fetchUrlText('https://x.example.com/')).rejects.toThrow(
      /tamaño máximo/,
    );
  });

  it('corta una respuesta que tarda demasiado', async () => {
    serve([{ timeout: true }]);
    await expect(fetchUrlText('https://x.example.com/')).rejects.toThrow(
      /tardó demasiado/,
    );
  });

  it('un dominio que no resuelve da un error claro', async () => {
    (lookup as unknown as jest.Mock).mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      fetchUrlText('https://no-existe.example.com/'),
    ).rejects.toThrow('No se pudo resolver el dominio');
  });
});
