// chatia-backend/src/modules/common/webhooks/webhooks.controller.ts
// Entry point público de webhooks entrantes de canales (WhatsApp, Instagram, Messenger, TikTok).
// Sin TenantGuard: la autenticidad se valida por verifyToken (GET) y firma HMAC (POST) en WebhooksService.
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ChannelType } from '@/generated/prisma/client.js';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';

function parseChannelType(raw: string): ChannelType {
  const value = raw.toUpperCase();
  if (!Object.values(ChannelType).includes(value as ChannelType)) {
    throw new NotFoundException('Canal desconocido');
  }
  return value as ChannelType;
}

// Sin throttle por IP: Meta envía ráfagas desde pocas IPs. La autenticidad la da la firma HMAC.
@SkipThrottle()
@ApiTags('webhooks')
// Ambas rutas: /api/v1/webhooks (la que se le muestra al usuario en ChannelAccount.webhookUrl) y /webhooks (legacy)
@Controller(['api/v1/webhooks', 'webhooks'])
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  // Webhook ÚNICO de la app de Meta de la plataforma (Tech Provider, ADR-024): una sola URL para todos los clientes,
  // el número sale del payload. Va antes de la ruta con id; no colisiona (un segmento vs. dos).
  @Get('whatsapp')
  verifyPlatform(@Query() query: Record<string, string>, @Res() res: Response) {
    res.send(this.svc.verifyPlatform(query));
  }

  @Post('whatsapp')
  @HttpCode(200)
  async handlePlatformEvent(
    @Body() payload: unknown,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const header = req.headers['x-hub-signature-256'];
    const sig = Array.isArray(header) ? header[0] : header;
    return this.svc.handlePlatformEvent(payload, req.rawBody, sig);
  }

  @Get(':channelType/:externalId')
  async verify(
    @Param('channelType') ct: string,
    @Param('externalId') externalId: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const challenge = await this.svc.verify(
      parseChannelType(ct),
      externalId,
      query,
    );
    res.send(challenge);
  }

  @Post(':channelType/:externalId')
  @HttpCode(200)
  async handleEvent(
    @Param('channelType') ct: string,
    @Param('externalId') externalId: string,
    @Body() payload: unknown,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const header =
      req.headers['x-hub-signature-256'] ?? req.headers['x-tiktok-signature'];
    const sig = Array.isArray(header) ? header[0] : header;

    await this.svc.handleEvent(
      parseChannelType(ct),
      externalId,
      payload,
      req.rawBody,
      sig,
    );
    return { status: 'ok' };
  }
}
