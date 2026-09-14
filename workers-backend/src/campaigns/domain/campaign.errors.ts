// workers-backend/src/campaigns/domain/campaign.errors.ts
import type { CampaignStatus } from './campaign.entity.js';

export class InvalidCampaignTransitionError extends Error {
  constructor(from: CampaignStatus, to: CampaignStatus) {
    super(`Campaign cannot transition from ${from} to ${to}`);
    this.name = 'InvalidCampaignTransitionError';
  }
}

export class CampaignNotFoundError extends Error {
  constructor(id: string) {
    super(`Campaign ${id} not found`);
    this.name = 'CampaignNotFoundError';
  }
}
