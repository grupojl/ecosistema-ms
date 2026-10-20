// src/infrastructure/channels/whatsapp/graph-api.ts
// Versión de la Graph API de Meta: configurable por entorno para no quedar atada a una versión que Meta retira.
const DEFAULT_GRAPH_VERSION = 'v23.0';

export function graphBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const version = env['META_GRAPH_VERSION'] || DEFAULT_GRAPH_VERSION;
  return `https://graph.facebook.com/${version}`;
}
