// marketing-backend/src/core/ad-accounts/interfaces/ad-platform.tokens.ts
// Tokens NestJS para inyección de dependencias.
// El core inyecta estas abstracciones — nunca importa los adapters directamente.
// La dirección de dependencia es: infrastructure → core

export const META_ADS_TOKEN   = Symbol("META_ADS_TOKEN");
export const GOOGLE_ADS_TOKEN = Symbol("GOOGLE_ADS_TOKEN");
export const TIKTOK_ADS_TOKEN = Symbol("TIKTOK_ADS_TOKEN");
