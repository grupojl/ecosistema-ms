// Protección SSRF: qué direcciones se consideran internas. Un error acá deja a un atacante pedirle al servidor
// que lea metadata de la nube o servicios de la red privada, así que se prueban los LÍMITES de cada rango.
import { isPrivateAddress } from '@/core/faq/ingestion/safe-url-fetch.js';

describe('isPrivateAddress — límites de cada rango', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '127.0.0.1',
    '127.255.255.254',
    '100.64.0.0', // CGNAT (inicio)
    '100.127.255.255', // CGNAT (fin)
    '169.254.169.254', // metadata de la nube
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.168.0.1',
    '192.168.255.255',
    '198.18.0.1',
    '198.19.255.255',
    '224.0.0.1', // multicast
    '255.255.255.255',
  ])('%s es interna', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '100.63.255.255', // justo antes del CGNAT
    '100.128.0.1', // justo después del CGNAT
    '169.253.1.1',
    '169.255.1.1',
    '172.15.255.255', // justo antes de 172.16/12
    '172.32.0.1', // justo después
    '192.0.1.1', // fuera de 192.0.0.0/24
    '192.0.2.1' /* TEST-NET: no está en la lista bloqueada */,
    '192.167.1.1',
    '192.169.1.1',
    '198.17.255.255',
    '198.20.0.1',
    '223.255.255.255', // último unicast
    '11.0.0.1',
    '126.255.255.255',
    '128.0.0.1',
  ])('%s es pública', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it.each(['no-es-ip', '', '999.1.1.1', '1.2.3', 'localhost'])(
    'un valor que no es IP (%p) no se confía',
    (v) => {
      expect(isPrivateAddress(v)).toBe(true);
    },
  );
});
