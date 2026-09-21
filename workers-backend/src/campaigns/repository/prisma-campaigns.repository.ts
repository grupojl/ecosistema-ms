// workers-backend/src/campaigns/repository/prisma-campaigns.repository.ts
// Adaptador concreto — ÚNICO lugar con PrismaService en el módulo campaigns.
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  ICampaignsRepository,
  CampaignRecord,
  CampaignRecipientRecord,
} from "./campaigns.repository.interface.js";

@Injectable()
export class PrismaCampaignsRepository implements ICampaignsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<CampaignRecord | null> {
    const row = await this.prisma.campaign.findFirst({
      where:   { id, organizationId },
      include: { _count: { select: { recipients: true } } },
    });
    return row as CampaignRecord | null;
  }

  async findAll(organizationId: string, status?: string): Promise<CampaignRecord[]> {
    const rows = await this.prisma.campaign.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as never } : {}),
      },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows as CampaignRecord[];
  }

  async findDueScheduled(limit: number): Promise<CampaignRecord[]> {
    const rows = await this.prisma.campaign.findMany({
      where:   { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      take:    limit,
      orderBy: { scheduledAt: "asc" },
    });
    return rows as CampaignRecord[];
  }

  async create(data: {
    ecosystemId:    string;
    organizationId: string;
    templateKey:    string;
    scheduledAt?:   Date;
  }): Promise<CampaignRecord> {
    const row = await this.prisma.campaign.create({ data: data as never });
    return row as CampaignRecord;
  }

  async update(id: string, patch: {
    status?:      string;
    startedAt?:   Date;
    completedAt?: Date;
  }): Promise<CampaignRecord> {
    const row = await this.prisma.campaign.update({
      where: { id },
      data:  patch as never,
    });
    return row as CampaignRecord;
  }

  async findPendingRecipients(campaignId: string): Promise<CampaignRecipientRecord[]> {
    const rows = await this.prisma.campaignRecipient.findMany({
      where:  { campaignId, status: "PENDING" },
      select: { id: true, campaignId: true, contactId: true, email: true, status: true, sentAt: true },
    });
    return rows as CampaignRecipientRecord[];
  }
}
