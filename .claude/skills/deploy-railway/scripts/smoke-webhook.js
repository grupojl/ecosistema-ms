#!/usr/bin/env node
// Smoke test de un despliegue de chatia-backend (staging o producción) con un webhook de WhatsApp FIRMADO.
//   node .claude/skills/deploy-railway/scripts/smoke-webhook.js --url https://<app>.up.railway.app \
//        --external-id <phone_number_id> --secret <META_APP_SECRET> [--verify-token <token>] [--channel WHATSAPP]
// Variables alternativas: SMOKE_URL, SMOKE_EXTERNAL_ID, META_APP_SECRET, SMOKE_VERIFY_TOKEN.
// Pasos: /health/live → /health/ready → verificación GET del webhook → POST firmado (espera 200)
//        → POST con firma inválida (espera 401) → POST sin firma (espera 401).
// El POST firmado crea un mensaje REAL en la conversación de ese canal: usar una cuenta de prueba.
// Después de correrlo, mirar los logs de Railway: debe aparecer el job `auto-reply` y el envío saliente.
const crypto = require('crypto');

const arg = (name, env) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : process.env[env];
};
const base = (arg('url', 'SMOKE_URL') || '').replace(/\/$/, '');
const externalId = arg('external-id', 'SMOKE_EXTERNAL_ID');
const secret = arg('secret', 'META_APP_SECRET');
const verifyToken = arg('verify-token', 'SMOKE_VERIFY_TOKEN');
const channel = (arg('channel', 'SMOKE_CHANNEL') || 'WHATSAPP').toUpperCase();

if (!base || !externalId || !secret) {
  console.error('Faltan datos. Uso: --url <https://app> --external-id <id del canal> --secret <META_APP_SECRET> [--verify-token <t>]');
  process.exit(2);
}

const url = `${base}/api/v1/webhooks/${channel}/${externalId}`;
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function main() {
  // 1) Salud
  for (const p of ['/health/live', '/health/ready']) {
    try {
      const r = await fetch(base + p);
      check(`GET ${p}`, r.status === 200, `HTTP ${r.status}${r.status !== 200 ? ' ' + (await r.text()).slice(0, 200) : ''}`);
    } catch (e) {
      check(`GET ${p}`, false, String(e.message || e));
    }
  }

  // 2) Verificación del webhook (handshake de Meta)
  if (verifyToken) {
    const challenge = `smoke-${Date.now()}`;
    const q = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': verifyToken, 'hub.challenge': challenge });
    const r = await fetch(`${url}?${q}`);
    const body = await r.text();
    check('GET verificación del webhook', r.status === 200 && body === challenge, `HTTP ${r.status}`);
    const bad = await fetch(`${url}?${new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'incorrecto', 'hub.challenge': 'x' })}`);
    check('GET con token incorrecto se rechaza', bad.status === 401, `HTTP ${bad.status}`);
  } else {
    console.log('SKIP  verificación GET (pasar --verify-token para probarla)');
  }

  // 3) POST firmado
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: `wamid.SMOKE${Date.now()}`,
                  from: '5490000000000',
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: 'smoke test: hola' },
                },
              ],
              contacts: [{ wa_id: '5490000000000', profile: { name: 'Smoke Test' } }],
            },
          },
        ],
      },
    ],
  };
  const raw = JSON.stringify(payload);
  const sign = (s, body) => 'sha256=' + crypto.createHmac('sha256', s).update(body).digest('hex');
  const post = (headers, body = raw) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

  let r = await post({ 'x-hub-signature-256': sign(secret, raw) });
  check('POST firmado correctamente → 200', r.status === 200, `HTTP ${r.status}`);

  r = await post({ 'x-hub-signature-256': sign('otro-secreto', raw) });
  check('POST con firma inválida → 401', r.status === 401, `HTTP ${r.status}`);

  r = await post({});
  check('POST sin firma → 401', r.status === 401, `HTTP ${r.status}`);

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${failed === 0 ? 'SMOKE OK' : `SMOKE CON ${failed} FALLO(S)`}`);
  if (failed === 0) {
    console.log('Siguiente: en los logs de Railway buscar el job auto-reply y el envío saliente (o su error de Meta,');
    console.log('que es esperable con un número de prueba: lo importante es que el job se encole y se procese).');
  }
  // process.exitCode (no process.exit): en Windows, salir con conexiones fetch abiertas aborta Node con un assert de libuv
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error('Error inesperado:', e);
  process.exitCode = 1;
});
