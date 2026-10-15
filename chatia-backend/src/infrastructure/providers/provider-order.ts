// src/infrastructure/providers/provider-order.ts
// Orden de la cadena de proveedores por capacidad, configurable por env
// (ej. LLM_PROVIDERS=groq,siliconflow). Nombres desconocidos se ignoran.

export function parseProviderOrder<T extends string>(
  raw: string | undefined,
  known: readonly T[],
  defaults: readonly T[],
): T[] {
  const knownNames: readonly string[] = known;
  const requested = (raw ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name): name is T => knownNames.includes(name));

  const unique = [...new Set(requested)];
  return unique.length > 0 ? unique : [...defaults];
}
