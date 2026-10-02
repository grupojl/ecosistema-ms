// job-id.helper.ts — BullMQ Job.id es string | undefined
export function requireJobId(id: string | undefined, context: string): string {
  if (id == null) throw new Error(`[requireJobId] job sin id — ${context}`);
  return id;
}
