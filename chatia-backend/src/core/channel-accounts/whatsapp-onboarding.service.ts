// src/core/channel-accounts/whatsapp-onboarding.service.ts
// Alta de WhatsApp por organización con Embedded Signup (ADR-024): el cliente conecta SU WABA y SU número,
// la plataforma canjea el código por el token del cliente, lo guarda cifrado y suscribe la WABA a la app.
import { randomInt, randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CHANNEL_ACCOUNTS_REPOSITORY,
  type IChannelAccountsRepository,
} from '@/core/channel-accounts/repository/channel-accounts.repository.interface.js';
import { toPublicAccount } from '@/core/channel-accounts/channel-accounts.service.js';
import type { WhatsAppEmbeddedSignupInput } from '@/core/channel-accounts/schemas.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import {
  GraphApiError,
  WHATSAPP_GRAPH,
  type IWhatsAppGraph,
} from '@/core/channel-accounts/whatsapp-graph.port.js';

@Injectable()
export class WhatsAppOnboardingService {
  private readonly logger = new Logger(WhatsAppOnboardingService.name);

  constructor(
    @Inject(CHANNEL_ACCOUNTS_REPOSITORY)
    private readonly repo: IChannelAccountsRepository,
    private readonly cipher: TokenCipher,
    @Inject(WHATSAPP_GRAPH) private readonly graph: IWhatsAppGraph,
  ) {}

  async connect(
    organizationId: string,
    role: string,
    dto: WhatsAppEmbeddedSignupInput,
  ) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo un propietario o administrador puede conectar WhatsApp',
      );
    }
    const creds = this.graph.appCredentials();
    if (!creds) {
      throw new ServiceUnavailableException(
        'La plataforma no tiene configurada la app de Meta (META_APP_ID / META_APP_SECRET)',
      );
    }

    try {
      const token = await this.graph.exchangeCode(dto.code);

      // El wabaId/phoneNumberId llegan del navegador: se comprueba contra Meta que el número pertenece a esa WABA
      // y que el token del cliente la administra, en vez de confiar en el body.
      const phones = await this.graph.listPhoneNumbers(dto.wabaId, token);
      const phone = phones.find((p) => p.id === dto.phoneNumberId);
      if (!phone) {
        throw new BadRequestException(
          'El número no pertenece a la cuenta de WhatsApp indicada',
        );
      }

      const existing = await this.repo.findByChannel(
        'WHATSAPP',
        dto.phoneNumberId,
      );
      if (existing && existing.organizationId !== organizationId) {
        throw new ConflictException(
          'Este número ya está conectado a otra organización',
        );
      }

      await this.graph.subscribeApp(dto.wabaId, token);
      const subscribed = await this.graph.listSubscribedAppIds(
        dto.wabaId,
        token,
      );
      if (!subscribed.includes(creds.appId)) {
        throw new BadGatewayException(
          'Meta no confirmó la suscripción de la cuenta a la app',
        );
      }

      // El registro puede fallar si el número ya estaba registrado: no bloquea el alta, pero se informa.
      const registered = await this.graph
        .registerPhone(
          dto.phoneNumberId,
          token,
          String(randomInt(0, 1_000_000)).padStart(6, '0'),
        )
        .then(() => true)
        .catch((e: unknown) => {
          this.logger.warn(
            `Registro del número ${dto.phoneNumberId} no completado: ${e instanceof Error ? e.message : 'error'}`,
          );
          return false;
        });

      const name = dto.name ?? (phone.verifiedName || phone.displayPhoneNumber);
      const encryptedToken = this.cipher.encrypt(token);
      const extraConfig = this.cipher.encryptExtraConfig({
        wabaId: dto.wabaId,
        displayPhoneNumber: phone.displayPhoneNumber,
        connectedVia: 'embedded-signup',
      });

      const account = existing
        ? await this.repo.update(existing.id, {
            name,
            accessToken: encryptedToken,
            extraConfig,
            isActive: true,
          })
        : await this.repo.create({
            organizationId,
            channelType: 'WHATSAPP',
            name,
            externalId: dto.phoneNumberId,
            accessToken: encryptedToken,
            extraConfig,
            webhookVerifyToken: randomUUID(),
          });

      const appUrl = process.env['APP_URL'] ?? 'http://localhost:3010';
      return {
        success: true,
        data: {
          ...toPublicAccount(account),
          // Meta registra UNA sola URL de callback para toda la app (ADR-024): el número se enruta por el payload
          webhookUrl: `${appUrl}/api/v1/webhooks/whatsapp`,
          subscribed: true,
          registered,
        },
      };
    } catch (e) {
      throw this.translate(e);
    }
  }

  /**
   * WhatsApp activo de la organización con su estado en Meta, o `data: null` si no hay ninguno conectado.
   * Lo consume sass-back (llamada interna) para mostrar la conexión en el panel del dueño.
   */
  async current(organizationId: string) {
    const accounts = await this.repo.listByOrganization(organizationId);
    const account = accounts.find(
      (a) => a.channelType === 'WHATSAPP' && a.isActive,
    );
    if (!account) return { success: true, data: null };

    const extra = this.cipher.decryptExtraConfig(
      (account.extraConfig ?? {}) as Record<string, unknown>,
    );
    const { data: state } = await this.status(account.id, organizationId);
    return {
      success: true,
      data: {
        accountId: account.id,
        displayPhoneNumber:
          typeof extra['displayPhoneNumber'] === 'string'
            ? extra['displayPhoneNumber']
            : null,
        ...state,
      },
    };
  }

  /**
   * Desconecta el WhatsApp de la organización: deja de recibir webhooks (la suscripción en Meta se quita en lo posible,
   * y los webhooks de una cuenta inactiva se rechazan igual) y el token del cliente se descarta.
   */
  async disconnect(id: string, organizationId: string) {
    const account = await this.repo.findOwned(id, organizationId);
    if (!account || account.channelType !== 'WHATSAPP') {
      throw new NotFoundException('Cuenta no encontrada');
    }
    const extra = this.cipher.decryptExtraConfig(
      (account.extraConfig ?? {}) as Record<string, unknown>,
    );
    const wabaId = typeof extra['wabaId'] === 'string' ? extra['wabaId'] : null;

    if (wabaId && account.isActive) {
      // Mejor esfuerzo: si el token ya venció o Meta falla, igual se desactiva la cuenta acá.
      await this.graph
        .unsubscribeApp(wabaId, this.cipher.decrypt(account.accessToken))
        .catch((e: unknown) =>
          this.logger.warn(
            `No se pudo quitar la suscripción de la WABA ${wabaId}: ${e instanceof Error ? e.message : 'error'}`,
          ),
        );
    }

    await this.repo.update(id, {
      isActive: false,
      accessToken: this.cipher.encrypt('disconnected'),
    });
    return { success: true, data: { disconnected: true } };
  }

  /** Estado de la conexión de una cuenta de la organización: ¿token vigente? ¿WABA suscrita a la app? */
  async status(id: string, organizationId: string) {
    const account = await this.repo.findOwned(id, organizationId);
    if (!account || account.channelType !== 'WHATSAPP') {
      throw new NotFoundException('Cuenta no encontrada');
    }
    const extra = this.cipher.decryptExtraConfig(
      (account.extraConfig ?? {}) as Record<string, unknown>,
    );
    const wabaId = typeof extra['wabaId'] === 'string' ? extra['wabaId'] : null;
    const creds = this.graph.appCredentials();
    if (!wabaId || !creds) {
      return {
        success: true,
        data: { connected: false, reason: 'Cuenta sin WABA registrada' },
      };
    }

    try {
      const token = this.cipher.decrypt(account.accessToken);
      const [phones, subscribed] = await Promise.all([
        this.graph.listPhoneNumbers(wabaId, token),
        this.graph.listSubscribedAppIds(wabaId, token),
      ]);
      const phone = phones.find((p) => p.id === account.externalId);
      return {
        success: true,
        data: {
          connected: Boolean(phone) && subscribed.includes(creds.appId),
          subscribed: subscribed.includes(creds.appId),
          phone: phone ?? null,
        },
      };
    } catch (e) {
      if (e instanceof GraphApiError) {
        return {
          success: true,
          data: {
            connected: false,
            reason:
              e.graphCode === 190
                ? 'Token vencido o revocado: hay que reconectar la cuenta'
                : 'Meta rechazó la consulta',
          },
        };
      }
      throw e;
    }
  }

  private translate(e: unknown): Error {
    if (!(e instanceof GraphApiError)) return e as Error;
    this.logger.warn(`Graph API: ${e.httpStatus} #${e.graphCode ?? '-'}`);
    if (e.httpStatus === 400 || e.httpStatus === 401 || e.httpStatus === 403) {
      return new BadRequestException(
        'Meta rechazó la autorización. Repetí el proceso de conexión.',
      );
    }
    return new BadGatewayException(
      'No se pudo completar la operación con Meta',
    );
  }
}
