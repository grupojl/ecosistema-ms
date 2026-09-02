# DT-011 — Parche manual requerido en notifications.service.ts
#
# getStats() no filtra por ecosystemId.
#
# Cambio requerido en la firma:
#   async getStats(organizationId: string): Promise<...>
# →
#   async getStats(organizationId: string, ecosystemId: string): Promise<...>
#
# Y en el body, agregar al where del findMany/groupBy:
#   ecosystemId,
#
# También actualizar el call-site en notifications.controller.ts:
# extraer ecosystemId del TenantContext y pasarlo a getStats().
#
# DT-012 ADICIONAL — preferences.service.ts:getPreferences() sin ecosystemId
# Mismo fix: agregar ecosystemId al where.
