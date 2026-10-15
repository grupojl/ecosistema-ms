// Stub de firebase-admin/app para tests unitarios (evita cargar jose, que es ESM puro).
export type App = object;
export const getApps = (): App[] => [];
export const initializeApp = (): App => ({});
export const cert = (): object => ({});
