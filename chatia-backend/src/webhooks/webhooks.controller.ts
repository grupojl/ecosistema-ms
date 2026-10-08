// chatia-backend/src/webhooks/webhooks.controller.ts
// Entry point público de webhooks entrantes de canales (WhatsApp, Instagram, Messenger, TikTok).
// Sin TenantGuard: la autenticidad se valida por verifyToken (GET) y firma HMAC (POST) en WebhooksService.
import { Controller, Get, Post, Param, Query, Body, Req, Res, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ChannelType } from '@prisma/client';
import { WebhooksService } from '@/webhooks/webhooks.service.js';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  @Get(':channelType/:externalId')
  async verify(
    @Param('channelType') ct: string,
    @Param('externalId') externalId: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const challenge = await this.svc.verify(ct.toUpperCase() as ChannelType, externalId, query);
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
    const sig = req.headers['x-hub-signature-256'] as string
      ?? req.headers['x-tiktok-signature'] as string;

    await this.svc.handleEvent(
      ct.toUpperCase() as ChannelType,
      externalId,
      payload,
      req.rawBody ?? Buffer.from(''),
      sig,
    );
    return { status: 'ok' };
  }
}
