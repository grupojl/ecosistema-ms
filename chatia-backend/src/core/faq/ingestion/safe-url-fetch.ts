// src/core/faq/ingestion/safe-url-fetch.ts
//
// Descarga el texto de una URL que indicó un usuario (documentos de FAQ por URL).
// Es una superficie de SSRF: sin cuidado, alguien podría pedirle al servidor que lea
// http://169.254.169.254 (metadata de la nube), servicios internos de Railway o localhost.
//
// Defensas:
//  - solo http/https, sin credenciales en la URL
//  - se resuelve el DNS y se RECHAZA si cualquier dirección es privada/reservada
//  - la conexión se fija a la IP ya validada (evita DNS rebinding entre validar y conectar)
//  - redirecciones: máximo 3, validando cada salto con las mismas reglas
//  - tope de tamaño (2 MB) y de tiempo (10 s), y solo tipos de contenido de texto
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const TEXT_TYPES = /^(text\/|application\/(json|xml|xhtml\+xml))/i;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/** true si la IP es privada, de loopback, link-local, multicast o reservada. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateV4(address);
  if (version === 6) return isPrivateV6(address);
  return true; // no es una IP válida → no se confía
}

function isPrivateV4(ip: string): boolean {
  const [a = 0, b = 0, c = 0] = ip.split('.').map(Number);
  return (
    a === 0 || // "esta red"
    a === 10 || // privada
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local (metadata cloud)
    (a === 172 && b >= 16 && b <= 31) || // privada
    (a === 192 && b === 0 && c === 0) || // IETF
    (a === 192 && b === 168) || // privada
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast + reservadas
  );
}

function isPrivateV6(ip: string): boolean {
  const addr = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped?.[1]) return isPrivateV4(mapped[1]); // IPv4 mapeada en IPv6
  return (
    addr === '::' ||
    addr === '::1' ||
    addr.startsWith('fc') ||
    addr.startsWith('fd') || // única local fc00::/7
    /^fe[89ab]/.test(addr) || // link-local fe80::/10
    addr.startsWith('ff') // multicast
  );
}

/** Convierte HTML en texto plano legible (sin scripts, estilos ni etiquetas). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)>|<br\s*\/?>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Valida la URL, resuelve el DNS y devuelve la IP segura a la que conectarse. */
export async function resolveSafeTarget(
  rawUrl: string,
): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('URL inválida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new UnsafeUrlError('Solo se permiten URLs http/https');
  if (url.username || url.password)
    throw new UnsafeUrlError('La URL no puede incluir credenciales');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) as 4 | 6 }]
    : await lookup(host, { all: true }).catch(() => {
        throw new UnsafeUrlError('No se pudo resolver el dominio');
      });

  if (
    addresses.length === 0 ||
    addresses.some((a) => isPrivateAddress(a.address))
  ) {
    throw new UnsafeUrlError('La URL apunta a una dirección no permitida');
  }
  const first = addresses[0];
  return { url, address: first.address, family: first.family as 4 | 6 };
}

function requestOnce(
  url: URL,
  address: string,
  family: 4 | 6,
): Promise<{
  status: number;
  location?: string;
  contentType: string;
  body: Buffer;
}> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: 'GET',
        timeout: TIMEOUT_MS,
        headers: {
          'user-agent': 'chatia-ingest/1.0',
          accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.1',
        },
        // Conexión fijada a la IP ya validada; el SNI/Host siguen siendo el dominio original
        lookup: (_host, _opts, cb) => cb(null, address, family),
      } as http.RequestOptions,
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(
              new UnsafeUrlError('El documento supera el tamaño máximo (2 MB)'),
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            location: res.headers.location,
            contentType: String(res.headers['content-type'] ?? ''),
            body: Buffer.concat(chunks),
          }),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () =>
      req.destroy(new UnsafeUrlError('La URL tardó demasiado en responder')),
    );
    req.on('error', reject);
    req.end();
  });
}

/** Descarga una URL de forma segura y devuelve su texto plano. */
export async function fetchUrlText(rawUrl: string): Promise<string> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = await resolveSafeTarget(current);
    const res = await requestOnce(target.url, target.address, target.family);

    if (res.status >= 300 && res.status < 400 && res.location) {
      current = new URL(res.location, target.url).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300)
      throw new UnsafeUrlError(`La URL respondió ${res.status}`);
    if (!TEXT_TYPES.test(res.contentType)) {
      throw new UnsafeUrlError(
        `Tipo de contenido no soportado (${res.contentType || 'desconocido'}): solo texto/HTML`,
      );
    }

    const raw = res.body.toString('utf8');
    return /html/i.test(res.contentType) ? htmlToText(raw) : raw.trim();
  }
  throw new UnsafeUrlError('Demasiadas redirecciones');
}
