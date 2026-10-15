import {
  htmlToText,
  isPrivateAddress,
  resolveSafeTarget,
  UnsafeUrlError,
} from '@/core/faq/ingestion/safe-url-fetch.js';

describe('isPrivateAddress (anti-SSRF)', () => {
  it.each([
    '127.0.0.1',
    '127.8.8.8',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // metadata de AWS/GCP/Azure
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '::1',
    '::',
    'fd00::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.1.2.3',
    'no-es-una-ip',
  ])('%s es privada/reservada', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.0.1',
    '172.32.0.1',
    '100.63.0.1',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
  ])('%s es pública', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('resolveSafeTarget', () => {
  it('rechaza esquemas que no son http/https', async () => {
    for (const url of [
      'file:///etc/passwd',
      'ftp://example.com/x',
      'gopher://x',
      'javascript:alert(1)',
    ]) {
      await expect(resolveSafeTarget(url)).rejects.toThrow(UnsafeUrlError);
    }
  });

  it('rechaza IPs privadas literales, incluida la metadata de la nube', async () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1:8080/',
      'http://[::1]/',
      'http://192.168.0.10/admin',
    ]) {
      await expect(resolveSafeTarget(url)).rejects.toThrow(/no permitida/);
    }
  });

  it('rechaza localhost (resuelve a loopback)', async () => {
    await expect(resolveSafeTarget('http://localhost/')).rejects.toThrow(
      UnsafeUrlError,
    );
  });

  it('rechaza credenciales embebidas y URLs inválidas', async () => {
    await expect(
      resolveSafeTarget('http://user:pass@8.8.8.8/'),
    ).rejects.toThrow(/credenciales/);
    await expect(resolveSafeTarget('no es una url')).rejects.toThrow(
      /inválida/,
    );
  });

  it('acepta una IP pública literal y devuelve a qué conectarse', async () => {
    await expect(
      resolveSafeTarget('https://8.8.8.8/dns'),
    ).resolves.toMatchObject({ address: '8.8.8.8', family: 4 });
  });
});

describe('htmlToText', () => {
  it('quita scripts, estilos, comentarios y etiquetas', () => {
    const html =
      '<html><head><title>x</title><style>p{}</style></head><body><script>evil()</script><!-- c --><h1>Título</h1><p>Hola&nbsp;<b>mundo</b> &amp; todos</p></body></html>';
    const text = htmlToText(html);
    expect(text).toContain('Título');
    expect(text).toContain('Hola mundo & todos');
    expect(text).not.toMatch(/evil|<|p\{\}/);
  });

  it('conserva la separación entre párrafos', () => {
    expect(htmlToText('<p>Uno</p><p>Dos</p>')).toBe('Uno\n\nDos');
  });
});
