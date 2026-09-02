# DT-006 — Parche manual requerido en reconciliation.service.ts
#
# El script agregó el import de ConfigService.
# Completar manualmente los siguientes cambios:
#
# 1. Inyectar ConfigService en el constructor:
#
#    constructor(
#      @InjectQueue(QUEUE_RECONCILE) private readonly queue: Queue,
#      private readonly prisma: PrismaService,
#      private readonly providers: ProviderRegistry,
# +    private readonly config: ConfigService,   // ← AGREGAR
#    ) {}
#
# 2. En schedulePendingReconciliation(), dentro del findMany, agregar filtro:
#
#    const pending = await this.prisma.payment.findMany({
#      where: {
#        status: PaymentStatus.PENDING,
# +      tenantId: this.config.get<string>('TENANT_ID'),  // ← AGREGAR
#        updatedAt: { lt: thirtyMinutesAgo },
#      },
#      take: 100,
#    });
#
# NOTA: Si el servicio maneja múltiples tenants en el mismo pod (no es el caso
# actual), reemplazar el filtro fijo por un loop por tenant activo desde DB.
# Ver auditoria-multitenant.md para el contexto completo.
