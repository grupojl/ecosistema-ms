// Stub de firebase-admin/auth para tests unitarios.
export type DecodedIdToken = Record<string, unknown>;
export const getAuth = (): {
  verifyIdToken: () => Promise<DecodedIdToken>;
} => ({
  verifyIdToken: () =>
    Promise.reject(new Error('firebase stub: usar mock en el test')),
});
