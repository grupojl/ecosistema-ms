// firebase-admin se resuelve a stubs en jest (ver moduleNameMapper); acá se controla qué devuelven.
import * as app from 'firebase-admin/app';
import * as auth from 'firebase-admin/auth';
import { FirebaseService } from '@/infrastructure/firebase/firebase.service.js';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
  cert: jest.fn((c: unknown) => c),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('FirebaseService', () => {
  const env = { ...process.env };
  const mocked = {
    getApps: app.getApps as jest.Mock,
    initializeApp: app.initializeApp as jest.Mock,
    getAuth: auth.getAuth as jest.Mock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mocked.getApps.mockReturnValue([]);
    mocked.initializeApp.mockReturnValue({ name: 'app' });
    process.env['FIREBASE_PROJECT_ID'] = 'proj';
    process.env['FIREBASE_CLIENT_EMAIL'] = 'sa@proj.iam';
    process.env['FIREBASE_PRIVATE_KEY'] = 'linea1\\nlinea2';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('sin credenciales no se inicializa (y lo avisa) en vez de romper el arranque', () => {
    delete process.env['FIREBASE_PRIVATE_KEY'];
    const svc = new FirebaseService();
    svc.onModuleInit();
    expect(svc.isInitialized).toBe(false);
    expect(mocked.initializeApp).not.toHaveBeenCalled();
  });

  it('inicializa con las credenciales y restaura los saltos de línea de la clave privada', () => {
    const svc = new FirebaseService();
    svc.onModuleInit();
    expect(svc.isInitialized).toBe(true);
    const cred = (app.cert as jest.Mock).mock.calls[0]![0] as Record<
      string,
      string
    >;
    expect(cred['privateKey']).toBe('linea1\nlinea2');
    expect(cred['projectId']).toBe('proj');
  });

  it('reutiliza una app ya inicializada (hot reload)', () => {
    mocked.getApps.mockReturnValue([{ name: 'existente' }]);
    const svc = new FirebaseService();
    svc.onModuleInit();
    expect(svc.isInitialized).toBe(true);
    expect(mocked.initializeApp).not.toHaveBeenCalled();
  });

  it('verifyIdToken revoca-chequea (checkRevoked=true) y devuelve el token decodificado', async () => {
    const verify = jest.fn().mockResolvedValue({ uid: 'u1' });
    mocked.getAuth.mockReturnValue({ verifyIdToken: verify });
    const svc = new FirebaseService();
    svc.onModuleInit();
    expect(await svc.verifyIdToken('tok')).toEqual({ uid: 'u1' });
    expect(verify).toHaveBeenCalledWith('tok', true);
  });

  it('verifyIdToken sin inicializar lanza', async () => {
    delete process.env['FIREBASE_PROJECT_ID'];
    const svc = new FirebaseService();
    svc.onModuleInit();
    await expect(svc.verifyIdToken('tok')).rejects.toThrow('no inicializado');
  });
});
