// workers-backend/src/campaigns/repository/campaigns.repository.interface.ts
// Puerto (interface) de persistencia para campaigns.
// Token: CAMPAIGNS_REPOSITORY

export const CAMPAIGNS_REPOSITORY = Symbol("CAMPAIGNS_REPOSITORY");

export interface CampaignRecord {
  id:              string;
  ecosystemId:     string;
  organizationId:  string;
  templateKey:     string;
  status:          string;
  scheduledAt:     Date | null;
  startedAt:       Date | null;
  completedAt:     Date | null;
  totalRecipients: number;
  sentCount:       number;
  failedCount:     number;
  createdAt:       Date;
  updatedAt:       Date;
  _count?: { recipients: number };
}

export interface CampaignRecipientRecord {
  id:        string;
  campaignId: string;
  contactId:  string;
  email:      string | null;
  status:     string;
  sentAt:     Date | null;
}

export interface ICampaignsRepository {
  findById(id: string, organizationId: string): Promise<CampaignRecord | null>;

  findAll(organizationId: string, status?: string): Promise<CampaignRecord[]>;

  /**
   * Campañas listas para dispatch: status=SCHEDULED y scheduledAt <= now.
   * Usa limit para controlar cuántas se procesan por ciclo del cron.
   */
  findDueScheduled(limit: number): Promise<CampaignRecord[]>;

  create(data: {
    ecosystemId:    string;
    organizationId: string;
    templateKey:    string;
    scheduledAt?:   Date;
  }): Promise<CampaignRecord>;

  update(id: string, patch: {
    status?:      string;
    startedAt?:   Date;
    completedAt?: Date;
  }): Promise<CampaignRecord>;

  findPendingRecipients(
    campaignId: string,
  ): Promise<CampaignRecipientRecord[]>;
}
