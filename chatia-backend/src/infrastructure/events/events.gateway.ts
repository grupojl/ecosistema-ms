// src/infrastructure/events/events.gateway.ts
//
// WebSocket en tiempo real para el dashboard de agentes.
// SEGURIDAD: antes no autenticaba y cualquiera podía unirse a `org:<id>` / `conv:<id>` y recibir
// mensajes de otro tenant. Ahora:
//   - el handshake exige Bearer token (Firebase) + organizationId → TenantAuthService
//   - al conectar se une SOLO a la sala de su organización
//   - `join:conversation` / `join:agent` verifican que el recurso pertenezca a su organización
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket, Namespace } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TenantAuthService } from '@/infrastructure/common/services/tenant-auth.service.js';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { parseAllowedOrigins } from '@/infrastructure/security/cors.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';

interface AuthedSocketData {
  tenant?: TenantContext;
}

type JoinResult =
  { status: 'joined' | 'left'; room: string } | { status: 'forbidden' };

@WebSocketGateway({
  cors: {
    // Sin ALLOWED_ORIGINS no se acepta ningún origen (antes caía a '*')
    origin: parseAllowedOrigins(process.env['ALLOWED_ORIGINS']),
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly auth: TenantAuthService,
    private readonly prisma: PrismaService,
  ) {}

  /** Middleware de handshake: rechaza la conexión antes de que exista el socket. */
  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      void this.authenticate(socket).then(
        (tenant) => {
          (socket.data as AuthedSocketData).tenant = tenant;
          next();
        },
        (err: unknown) => {
          this.logger.warn(
            `WS rechazado: ${err instanceof Error ? err.message : String(err)}`,
          );
          next(new Error('unauthorized'));
        },
      );
    });
  }

  handleConnection(client: Socket): void {
    const tenant = this.tenantOf(client);
    if (!tenant) {
      client.disconnect(true);
      return;
    }
    void client.join(`org:${tenant.organizationId}`);
    this.logger.debug(
      `Cliente ${client.id} conectado a org:${tenant.organizationId}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('join:organization')
  handleJoinOrg(
    @MessageBody() organizationId: string,
    @ConnectedSocket() client: Socket,
  ): JoinResult {
    const tenant = this.tenantOf(client);
    if (!tenant || organizationId !== tenant.organizationId)
      return { status: 'forbidden' };
    void client.join(`org:${organizationId}`);
    return { status: 'joined', room: `org:${organizationId}` };
  }

  @SubscribeMessage('join:conversation')
  async handleJoinConv(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<JoinResult> {
    const tenant = this.tenantOf(client);
    if (!tenant || typeof conversationId !== 'string')
      return { status: 'forbidden' };

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        channelAccount: { organizationId: tenant.organizationId },
      },
      select: { id: true },
    });
    if (!conversation) return { status: 'forbidden' };

    void client.join(`conv:${conversationId}`);
    return { status: 'joined', room: `conv:${conversationId}` };
  }

  @SubscribeMessage('leave:conversation')
  handleLeaveConv(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ): JoinResult {
    void client.leave(`conv:${conversationId}`);
    return { status: 'left', room: `conv:${conversationId}` };
  }

  @SubscribeMessage('join:agent')
  async handleJoinAgent(
    @MessageBody() agentId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<JoinResult> {
    const tenant = this.tenantOf(client);
    if (!tenant || typeof agentId !== 'string') return { status: 'forbidden' };

    // `agent:<organizationId>` es la sala a nivel organización (typing/respuestas del asistente)
    if (agentId !== tenant.organizationId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: agentId, organizationId: tenant.organizationId },
        select: { id: true },
      });
      if (!agent) return { status: 'forbidden' };
    }

    void client.join(`agent:${agentId}`);
    return { status: 'joined', room: `agent:${agentId}` };
  }

  // ── Métodos que llaman los services ──────────────────────────────────────

  emitNewMessage(
    organizationId: string,
    conversationId: string,
    message: unknown,
  ) {
    this.server.to(`conv:${conversationId}`).emit('message:new', message);
    this.server.to(`org:${organizationId}`).emit('conversation:updated', {
      conversationId,
      event: 'new_message',
    });
  }

  emitConversationUpdated(organizationId: string, conversation: unknown) {
    this.server
      .to(`org:${organizationId}`)
      .emit('conversation:updated', conversation);
  }

  emitEscalation(organizationId: string, conversationId: string) {
    this.server.to(`org:${organizationId}`).emit('conversation:escalated', {
      conversationId,
    });
  }

  emitToAgent(agentId: string, event: string, data: unknown) {
    this.server.to(`agent:${agentId}`).emit(event, data);
  }

  /** Notifica al front que un mensaje falló definitivamente tras los reintentos */
  emitMessageFailed(
    organizationId: string,
    conversationId: string,
    messageId: string,
  ) {
    this.server
      .to(`conv:${conversationId}`)
      .emit('message:failed', { messageId });
    this.server.to(`org:${organizationId}`).emit('message:failed', {
      conversationId,
      messageId,
    });
  }

  // ── Autenticación del handshake ──────────────────────────────────────────

  private authenticate(socket: Socket): Promise<TenantContext> {
    const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    const headers = socket.handshake.headers;

    const rawToken =
      typeof auth['token'] === 'string'
        ? auth['token']
        : headers['authorization'];
    const organizationId =
      typeof auth['organizationId'] === 'string'
        ? auth['organizationId']
        : (headers['x-organization-id'] as string | undefined);

    return this.auth.authenticate({
      authorization:
        rawToken && !rawToken.startsWith('Bearer ')
          ? `Bearer ${rawToken}`
          : rawToken,
      organizationId,
    });
  }

  private tenantOf(client: Socket): TenantContext | undefined {
    return (client.data as AuthedSocketData).tenant;
  }
}
