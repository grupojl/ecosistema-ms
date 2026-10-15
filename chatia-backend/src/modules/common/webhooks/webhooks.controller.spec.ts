import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhooksController } from '@/modules/common/webhooks/webhooks.controller.js';
import type { WebhooksService } from '@/core/webhooks/webhooks.service.js';

describe('WebhooksController', () => {
  const svc = { verify: jest.fn(), handleEvent: jest.fn() };
  const controller = new WebhooksController(svc as unknown as WebhooksService);

  beforeEach(() => jest.clearAllMocks());

  it('reenvía el cuerpo crudo y la firma al servicio', async () => {
    const rawBody = Buffer.from('{}');
    const req = {
      headers: { 'x-hub-signature-256': 'sha256=abc' },
      rawBody,
    } as unknown as Request & { rawBody?: Buffer };
    await controller.handleEvent('whatsapp', 'pn-1', {}, req);
    expect(svc.handleEvent).toHaveBeenCalledWith(
      'WHATSAPP',
      'pn-1',
      {},
      rawBody,
      'sha256=abc',
    );
  });

  it('lee la firma de TikTok', async () => {
    const req = {
      headers: { 'x-tiktok-signature': 'deadbeef' },
      rawBody: Buffer.from('{}'),
    } as unknown as Request & { rawBody?: Buffer };
    await controller.handleEvent('tiktok', 'tt-1', {}, req);
    expect(svc.handleEvent).toHaveBeenCalledWith(
      'TIKTOK',
      'tt-1',
      {},
      expect.any(Buffer),
      'deadbeef',
    );
  });

  it('sin header de firma pasa undefined (el servicio rechaza)', async () => {
    const req = {
      headers: {},
      rawBody: Buffer.from('{}'),
    } as unknown as Request & { rawBody?: Buffer };
    await controller.handleEvent('whatsapp', 'pn-1', {}, req);
    expect(svc.handleEvent).toHaveBeenCalledWith(
      'WHATSAPP',
      'pn-1',
      {},
      expect.any(Buffer),
      undefined,
    );
  });

  it('canal desconocido → 404', async () => {
    const req = {
      headers: {},
      rawBody: Buffer.from('{}'),
    } as unknown as Request & { rawBody?: Buffer };
    await expect(
      controller.handleEvent('telegram', 'x', {}, req),
    ).rejects.toThrow(NotFoundException);
    const res = { send: jest.fn() } as unknown as Response;
    await expect(controller.verify('telegram', 'x', {}, res)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('GET de verificación responde el challenge', async () => {
    svc.verify.mockResolvedValue('challenge-123');
    const res = { send: jest.fn() } as unknown as Response;
    await controller.verify(
      'whatsapp',
      'pn-1',
      { 'hub.challenge': 'challenge-123' },
      res,
    );
    expect(res.send).toHaveBeenCalledWith('challenge-123');
  });
});
