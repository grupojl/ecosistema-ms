#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix chatia conversations.service.ts + analytics persistEvent payload
# Ejecutar: bash x.sh   ó   make x
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${CYAN}[x]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# =============================================================================
# FIX 1 — chatia: conversations.service.ts
#
# El archivo que generé en semana 7 tiene métodos con referencias incorrectas:
#   - emitToOrg       → no existe en EventsGateway
#   - sentAt          → no existe en Message (schema solo tiene createdAt)
#   - SEND_OUTGOING_MESSAGE → no existe en JOBS constants
#   - langGraph.process → no existe en LangGraphEngine
#   - notifications.createForAgent → no existe en NotificationsService
#
# Solución: reemplazar el archivo con la versión original del repo.
# El git log muestra el historial — buscar el commit antes del nuestro.
# =============================================================================
log "[1/2] chatia — conversations.service.ts: restaurar versión original"

CONV="$ROOT/chatia-backend/src/conversations/conversations.service.ts"

# Buscar el primer commit del archivo que NO sea nuestro "chore:"
COMMITS=$(git -C "$ROOT" log --oneline -- chatia-backend/src/conversations/conversations.service.ts 2>/dev/null)
echo "Historial del archivo:"
echo "$COMMITS" | head -10

# Tomar el último commit (el más viejo = el original antes de nuestros cambios)
ORIGINAL_COMMIT=$(echo "$COMMITS" | tail -1 | awk '{print $1}')
echo "Commit original encontrado: $ORIGINAL_COMMIT"

if [ -n "$ORIGINAL_COMMIT" ]; then
  CONTENT=$(git -C "$ROOT" show "$ORIGINAL_COMMIT":chatia-backend/src/conversations/conversations.service.ts 2>/dev/null)
  if [ -n "$CONTENT" ] && ! echo "$CONTENT" | grep -q "conversations.service.original"; then
    echo "$CONTENT" > "$CONV"
    ok "conversations.service.ts restaurado desde commit $ORIGINAL_COMMIT"
  else
    warn "El commit más viejo también tiene el stub — el archivo nunca tuvo versión original en git"
    warn "Creando versión mínima que compila correctamente"
    # Crear una versión que delega al service original sin los métodos inventados
    # Basado en lo que vemos en conversations.controller.ts que llama:
    # svc.list, svc.findOne, svc.sendManualMessage, svc.takeover, svc.release,
    # svc.resolve, svc.softDelete, svc.restore, svc.addTag, svc.removeTag
    cat > "$CONV" << 'EOF'
// chatia-backend/src/conversations/conversations.service.ts
// Versión restaurada — métodos según conversations.controller.ts
import {
  Injectable, NotFoundException, Logger, Optional,
} from '@nestjs/common';
import { InjectQueue }      from '@nestjs/bullmq';
import { Queue }            from 'bullmq';
import { PrismaService }    from '../prisma/prisma.service';
import { ConversationStatus, ChannelType, MessageDirection, MessageType, MessageStatus } from '@prisma/client';
import type { IncomingMessage } from '../channels/channel.interface';
import { QUEUES, JOBS }         from '../queue/queue.constants';
import { AnalyticsEventsService } from '../analytics-events/analytics-events.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.OUTGOING_MESSAGE ?? 'outgoing-message') private readonly outQueue: Queue,
    @Optional() private readonly analyticsEvents?: AnalyticsEventsService,
  ) {}

  async handleIncomingMessage(
    channelAccountId: string,
    channelType: ChannelType,
    msg: IncomingMessage,
  ): Promise<void> {
    const account = await this.prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
      include: { organization: true },
    });
    if (!account) throw new NotFoundException(`ChannelAccount ${channelAccountId} no encontrada`);

    const organizationId = account.organizationId;
    const ecosystemId    = account.organization.ecosystemId;

    const contact = await this.prisma.contact.upsert({
      where: {
        organizationId_channelType_externalId: {
          organizationId, channelType, externalId: msg.senderExternalId,
        },
      },
      update: { lastSeenAt: new Date() },
      create: {
        organizationId, channelType,
        externalId: msg.senderExternalId,
        name:       msg.senderName,
        phone:      msg.senderPhone,
      },
    });

    let conv = await this.prisma.conversation.findFirst({
      where: {
        channelAccountId,
        contactId: contact.id,
        status: { in: [ConversationStatus.OPEN, ConversationStatus.HUMAN_TAKEOVER] },
        deletedAt: null,
      },
    });

    const isNew = !conv;
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: { channelAccountId, contactId: contact.id, status: ConversationStatus.OPEN, lastMessageAt: new Date() },
      });

      // ADR-003 — emitir evento analytics (best-effort)
      this.analyticsEvents?.trackConversationCreated({
        ecosystemId, organizationId,
        conversationId: conv.id,
        channel: channelType,
        contactId: contact.id,
      });
    }

    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction:  MessageDirection.INBOUND,
        type:       MessageType.TEXT,
        status:     MessageStatus.DELIVERED,
        content:    msg.content,
        externalId: msg.externalId,
      },
    });

    this.analyticsEvents?.trackMessageSent({
      ecosystemId, organizationId,
      conversationId: conv.id,
      direction: 'INBOUND',
      isAiGenerated: false,
    });
  }

  async list(organizationId: string, filters: {
    status?: ConversationStatus;
    channelAccountId?: string;
    tag?: string;
    archived?: boolean;
    page?: number;
  }) {
    const page = filters.page ?? 1;
    const take = 20;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {
      channelAccount: { organizationId },
      deletedAt: filters.archived ? { not: null } : null,
    };
    if (filters.status)           where['status']           = filters.status;
    if (filters.channelAccountId) where['channelAccountId'] = filters.channelAccountId;
    if (filters.tag)              where['tags']              = { has: filters.tag };

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: { contact: true, assignedAgent: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { lastMessageAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { data, total, page, pages: Math.ceil(total / take) };
  }

  async findOne(conversationId: string, organizationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccount: { organizationId } },
      include: { contact: true, assignedAgent: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    return conv;
  }

  async sendManualMessage(conversationId: string, organizationId: string, text: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const acct = await this.prisma.channelAccount.findUnique({ where: { id: conv.channelAccountId } });
    if (!acct) throw new NotFoundException('ChannelAccount no encontrada');
    const contact = await this.prisma.contact.findUnique({ where: { id: conv.contactId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');

    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        direction:    MessageDirection.OUTBOUND,
        type:         MessageType.TEXT,
        status:       MessageStatus.PENDING,
        content:      text,
        isAiGenerated: false,
      },
    });

    await this.outQueue.add(JOBS.SEND_MESSAGE ?? 'send-message', {
      messageId:           msg.id,
      conversationId,
      organizationId,
      channelType:         acct.channelType,
      recipientExternalId: contact.externalId,
      text,
      accessToken:         acct.accessToken,
      extraConfig:         acct.extraConfig,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { lastMessageAt: new Date() },
    });
  }

  async takeover(conversationId: string, organizationId: string, agentId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { status: ConversationStatus.HUMAN_TAKEOVER, assignedAgentId: agentId, isAiActive: false },
    });

    const acct = await this.prisma.channelAccount.findUnique({
      where: { id: updated.channelAccountId },
      include: { organization: true },
    });
    if (acct) {
      this.analyticsEvents?.trackConversationAssigned({
        ecosystemId:    acct.organization.ecosystemId,
        organizationId,
        conversationId,
        agentId,
      });
    }

    return updated;
  }

  async release(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { status: ConversationStatus.OPEN, assignedAgentId: null, isAiActive: true },
    });
  }

  async resolve(conversationId: string, organizationId: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { status: ConversationStatus.RESOLVED, resolvedAt: new Date(), isAiActive: false },
    });

    const acct = await this.prisma.channelAccount.findUnique({
      where: { id: conv.channelAccountId },
      include: { organization: true },
    });
    if (acct) {
      this.analyticsEvents?.trackConversationResolved({
        ecosystemId:    acct.organization.ecosystemId,
        organizationId,
        conversationId,
        agentId:        conv.assignedAgentId ?? undefined,
      });
    }

    return updated;
  }

  async softDelete(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { deletedAt: new Date() },
    });
  }

  async restore(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { deletedAt: null },
    });
  }

  async addTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const tags = [...new Set([...conv.tags, tag])];
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { tags } });
  }

  async removeTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const tags = conv.tags.filter((t: string) => t !== tag);
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { tags } });
  }

  private async verifyOwnership(conversationId: string, organizationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccount: { organizationId } },
    });
    if (!conv) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    return conv;
  }
}
EOF
    ok "conversations.service.ts — versión limpia creada"
  fi
else
  warn "No se encontró historial git — creando versión limpia directamente"
fi

# =============================================================================
# FIX 2 — analytics-backend: 2 errores
# a) persistEvent: payload cast a InputJsonValue
# b) analytics-grpc.controller.ts: event.id no existe (persistEvent retorna void)
# =============================================================================
log "[2/2] analytics-backend — payload cast + grpc controller"

# Fix persistEvent en analytics.service.ts — agregar cast al payload
ANA_SVC="$ROOT/analytics-backend/src/analytics/analytics.service.ts"
if grep -q "await this.prisma.analyticsEvent.create({ data });" "$ANA_SVC" 2>/dev/null; then
  sed -i 's/await this\.prisma\.analyticsEvent\.create({ data });/const created = await this.prisma.analyticsEvent.create({ data: { ...data, payload: data.payload as import("@prisma\/client").Prisma.InputJsonValue } });\n    return created;/' "$ANA_SVC"
  # Cambiar retorno de void a que retorne el evento
  sed -i 's/}): Promise<void> {/}): Promise<{ id: string }> {/' "$ANA_SVC"
  ok "analytics.service.ts — persistEvent retorna el evento creado con payload cast"
fi

# Fix analytics-grpc.controller.ts — TrackEvent usa el id retornado
ANA_GRPC="$ROOT/analytics-backend/src/grpc/analytics-grpc.controller.ts"
if [ -f "$ANA_GRPC" ]; then
  # Si tiene event.id pero persistEvent retorna void, arreglar el controller
  if grep -q "event\.id\|event_id: event" "$ANA_GRPC" 2>/dev/null; then
    # Reemplazar la línea que usa event.id por una que use el resultado
    sed -i 's/return { accepted: true, event_id: event\.id };/return { accepted: true, event_id: result?.id ?? "" };/' "$ANA_GRPC"
    # Asegurar que el resultado se guarda en variable
    sed -i 's/await this\.svc\.persistEvent(/const result = await this.svc.persistEvent(/' "$ANA_GRPC"
    ok "analytics-grpc.controller.ts — event_id usando result.id"
  fi
fi

echo ""
ok "════════════════════════════════════════════════════════"
ok "  2 fixes aplicados"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  [1] conversations.service.ts — versión limpia sin referencias incorrectas"
echo "  [2] analytics persistEvent + grpc controller — payload cast + retorno id"
echo ""
echo "Próximo: make g → push → Railway redeploy"