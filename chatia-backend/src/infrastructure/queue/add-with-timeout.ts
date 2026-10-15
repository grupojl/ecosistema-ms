// src/infrastructure/queue/add-with-timeout.ts
// Encolar con tope de tiempo. Con Redis caído, `queue.add` de BullMQ NO falla: espera la conexión para siempre
// (medido: se cuelga indefinidamente; `enableOfflineQueue:false` tampoco lo evita). Sin tope, un webhook de Meta o el
// envío de un agente quedan colgados. Con tope responde 503 rápido y el proveedor reintenta; los `jobId` deterministas
// hacen que un add tardío que sí llegue a Redis no duplique trabajo.
import { ServiceUnavailableException } from '@nestjs/common';

const DEFAULT_TIMEOUT_MS = 3_000;

const timeoutMs = (): number => {
  const n = Number(process.env['QUEUE_ADD_TIMEOUT_MS']);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
};

export async function addWithTimeout<R>(
  add: () => Promise<R>,
  queueName: string,
): Promise<R> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new ServiceUnavailableException(
            `Cola "${queueName}" no disponible (Redis sin respuesta)`,
          ),
        ),
      timeoutMs(),
    );
  });
  try {
    return await Promise.race([add(), limit]);
  } finally {
    clearTimeout(timer);
  }
}
