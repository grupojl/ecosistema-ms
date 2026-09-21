// Invariante: accessToken NUNCA se retorna — solo se usa internamente en los processors.
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdPlatform } from '@prisma/client';

export interface ConnectAdAccountDto {
  ecosystemId: string; organizationId: string;
  platform: AdPlatform; externalId: string; name: string;
  accessToken: string; refreshToken?: string; tokenExpiresAt?: Date;
}

@Injectable()
export class AdAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async connect(dto: ConnectAdAccountDto) {
    const existing = await this.prisma.adAccount.findFirst({
      where: { platform: dto.platform, externalId: dto.externalId, organizationId: dto.organizationId },
    });
    if (existing) throw new ConflictException(`AdAccount ${dto.platform}:${dto.externalId} ya conectada`);
    // TODO(pii): cifrar accessToken antes de persistir — Fase 2
    const { accessToken: _at, refreshToken: _rt, ...safe } = await this.prisma.adAccount.create({ data: dto });
    return safe;
  }

  async findAll(ecosystemId: string, organizationId: string) {
    const accounts = await this.prisma.adAccount.findMany({ where: { ecosystemId, organizationId }, orderBy: { createdAt: 'desc' } });
    return accounts.map(({ accessToken: _at, refreshToken: _rt, ...safe }) => safe);
  }

  async disconnect(id: string, organizationId: string) {
    const account = await this.prisma.adAccount.findFirst({ where: { id, organizationId } });
    if (!account) throw new NotFoundException(`AdAccount ${id} no encontrada`);
    await this.prisma.adAccount.delete({ where: { id } });
    return { id, disconnected: true };
  }

  // Para processors — retorna accessToken (uso interno únicamente)
  async findForSync(ecosystemId: string, organizationId: string) {
    return this.prisma.adAccount.findMany({ where: { ecosystemId, organizationId, status: 'ACTIVE' } });
  }
}
