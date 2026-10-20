// chatia-backend/src/infrastructure/config/validation.schema.ts
// Migrado de joi a zod (joi no está en las dependencias del proyecto)
//
// En producción el arranque FALLA si falta algo crítico (mejor caerse al desplegar que quedar
// con la autenticación abierta o con los webhooks rechazando todo). NODE_ENV es obligatorio:
// antes tenía default 'development', lo que dejaba el bypass de desarrollo abierto si Railway no lo definía.
import { z } from 'zod';
import { parseEncryptionKey } from '@/infrastructure/security/token-cipher.js';

const optionalString = z.string().optional();

export const configValidationSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: z.coerce.number().default(3010),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    REDIS_ENABLED: optionalString,
    GROQ_API_KEY: optionalString,
    GROQ_MODEL: optionalString,
    JWT_SECRET: optionalString,

    // Seguridad
    ALLOW_DEV_AUTH: optionalString, // 'true' solo en desarrollo/test: habilita x-organization-id sin Firebase
    SWAGGER_ENABLED: optionalString, // 'true' para exponer /api/docs
    ALLOWED_ORIGINS: optionalString,
    PLATFORM_ADMIN_KEY: optionalString,
    INTERNAL_API_KEY: optionalString,
    CHAT_INTERNAL_API_KEY: optionalString,
    META_APP_SECRET: optionalString,
    META_WEBHOOK_VERIFY_TOKEN: optionalString, // verify token del webhook único de la app (GET /webhooks/whatsapp)
    META_APP_ID: optionalString, // app de la plataforma (Tech Provider): necesaria para el alta por Embedded Signup
    META_GRAPH_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/, 'Formato esperado: v23.0')
      .optional(),
    TIKTOK_APP_SECRET: optionalString,
    WIDGET_SESSION_SECRET: optionalString,
    CHANNEL_TOKEN_ENCRYPTION_KEY: optionalString, // 32 bytes base64/hex: cifra tokens de canales en la base
    CHANNEL_TOKEN_ENCRYPTION_KEY_PREVIOUS: optionalString, // solo para rotación (descifra)
    FIREBASE_PROJECT_ID: optionalString,
    FIREBASE_CLIENT_EMAIL: optionalString,
    FIREBASE_PRIVATE_KEY: optionalString,

    // Proveedores de fallback (opcionales: sin clave, el proveedor se saltea en la cadena)
    SILICONFLOW_API_KEY: optionalString,
    ELEVENLABS_API_KEY: optionalString,
    CARTESIA_API_KEY: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    // Orden de cada cadena, separado por comas (ej. LLM_PROVIDERS=groq,siliconflow)
    LLM_PROVIDERS: optionalString,
    STT_PROVIDERS: optionalString,
    TTS_PROVIDERS: optionalString,
    IMAGE_PROVIDERS: optionalString,
    EMBEDDINGS_PROVIDER: optionalString,
    EMBEDDINGS_MODEL: optionalString,
  })
  .superRefine((env, ctx) => {
    const fail = (path: string, message: string): void => {
      ctx.addIssue({ code: 'custom', path: [path], message });
    };

    if (env.NODE_ENV !== 'production') {
      return;
    }

    const minLen = (value: string | undefined, min: number): boolean =>
      (value?.length ?? 0) >= min;

    if (env.ALLOW_DEV_AUTH === 'true')
      fail(
        'ALLOW_DEV_AUTH',
        'No puede estar activo en producción (desactiva la autenticación)',
      );
    if (env.SWAGGER_ENABLED === 'true')
      fail('SWAGGER_ENABLED', 'Swagger no debe exponerse en producción');
    if (!minLen(env.WIDGET_SESSION_SECRET, 32))
      fail(
        'WIDGET_SESSION_SECRET',
        'Obligatorio en producción (mínimo 32 caracteres)',
      );
    if (!minLen(env.PLATFORM_ADMIN_KEY, 16))
      fail(
        'PLATFORM_ADMIN_KEY',
        'Obligatorio en producción (mínimo 16 caracteres)',
      );
    if (
      !minLen(env.INTERNAL_API_KEY, 16) &&
      !minLen(env.CHAT_INTERNAL_API_KEY, 16)
    ) {
      fail(
        'INTERNAL_API_KEY',
        'Obligatorio en producción (mínimo 16 caracteres)',
      );
    }
    if (!parseEncryptionKey(env.CHANNEL_TOKEN_ENCRYPTION_KEY)) {
      fail(
        'CHANNEL_TOKEN_ENCRYPTION_KEY',
        'Obligatoria en producción: 32 bytes en base64 o hex (openssl rand -base64 32)',
      );
    }
    if (!env.META_APP_SECRET)
      fail(
        'META_APP_SECRET',
        'Obligatorio en producción: sin él se rechazan todos los webhooks de Meta',
      );
    if (
      !env.FIREBASE_PROJECT_ID ||
      !env.FIREBASE_CLIENT_EMAIL ||
      !env.FIREBASE_PRIVATE_KEY
    ) {
      fail(
        'FIREBASE_PROJECT_ID',
        'Firebase Admin (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY) es obligatorio en producción',
      );
    }
    if (!env.ALLOWED_ORIGINS)
      fail(
        'ALLOWED_ORIGINS',
        'Obligatorio en producción (lista de orígenes permitidos para CORS)',
      );
    if (env.REDIS_ENABLED !== 'true')
      fail(
        'REDIS_ENABLED',
        'Debe ser "true" en producción (colas y límites de uso compartidos)',
      );
  });

export type ConfigSchema = z.infer<typeof configValidationSchema>;

/** Para ConfigModule.forRoot({ validate }) — falla el arranque si falta una variable requerida. */
export function validateEnv(config: Record<string, unknown>): ConfigSchema {
  const result = configValidationSchema.safeParse(config);
  if (!result.success) {
    const detail = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detail}`);
  }
  return result.data;
}
