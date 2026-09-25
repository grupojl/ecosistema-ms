// chatia-backend/src/modules/welver/welver.config.ts
import type { WELVERBusinessData } from './types/context.js';
import type { OrganizationProfile } from '../../core/strategies/project-context.interface.js';

export const WELVER_CONFIG = {
  defaultModel: 'llama-3.3-70b-versatile',
  defaultStage: 'INITIAL' as const,
  systemPromptTemplate: `
Eres el asistente virtual de {STORE_NAME}, una tienda de {STORE_CATEGORY}.
Tu rol es ayudar a los clientes a encontrar productos, resolver dudas sobre pedidos
y acompañarlos durante su experiencia de compra.

Tono: {TONE}
Idioma: {LOCALE}
{MARKETS_CONTEXT}

REGLAS CRÍTICAS:
- Nunca inventes stock, precios ni políticas que no estén en tu base de conocimiento.
- Si no sabés la respuesta → escalá a un agente humano, no inventes.
- Si el cliente pide hablar con una persona → escalá inmediatamente, sin resistencia.
- Respuestas concisas: máximo 3 párrafos cortos en canal de chat.
{HUMAN_AGENTS_CONTEXT}
  `.trim(),
  toneByPlan: {
    free:       'Informal y cercano',
    starter:    'Profesional y amigable',
    growth:     'Profesional y consultivo',
    enterprise: 'Sofisticado y orientado a soluciones',
  } as const,
} as const;

export function buildWelverSystemPrompt(
  bizData:    WELVERBusinessData,
  orgProfile: OrganizationProfile,
): string {
  const marketsCtx = bizData.activeMarkets.length > 0
    ? `Mercados activos: ${bizData.activeMarkets.join(', ')} — considerá diferencias regionales.`
    : '';
  const humanCtx = bizData.humanAgentsOnline
    ? 'Hay agentes humanos disponibles. Escalá si el cliente lo pide o supera tu conocimiento.'
    : 'No hay agentes humanos disponibles ahora. Ofrecé dejar mensaje para contacto posterior.';

  return WELVER_CONFIG.systemPromptTemplate
    .replace('{STORE_NAME}',           bizData.storeName)
    .replace('{STORE_CATEGORY}',       bizData.storeCategory)
    .replace('{TONE}',                 WELVER_CONFIG.toneByPlan[bizData.merchantPlan])
    .replace('{LOCALE}',               orgProfile.locale)
    .replace('{MARKETS_CONTEXT}',      marketsCtx)
    .replace('{HUMAN_AGENTS_CONTEXT}', humanCtx);
}
