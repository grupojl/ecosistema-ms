// workers-backend/src/campaigns/domain/campaign.entity.ts
// ADR-011 Sprint 2

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

export interface Campaign {
  readonly id:             string;
  readonly ecosystemId:    string;
  readonly organizationId: string;
  readonly name:           string;
  readonly status:         CampaignStatus;
  readonly templateKey:    string;
  readonly scheduledAt:    Date | null;
  readonly startedAt:      Date | null;
  readonly completedAt:    Date | null;
  readonly totalRecipients: number;
  readonly sentCount:      number;
  readonly failedCount:    number;
  readonly createdAt:      Date;
}

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT:      ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:  ['RUNNING', 'CANCELLED'],
  RUNNING:    ['DONE', 'FAILED'],
  DONE:       [],
  FAILED:     ['DRAFT'],       // permite reintento desde FAILED → DRAFT
  CANCELLED:  [],
};

export function assertValidCampaignTransition(
  from: CampaignStatus,
  to:   CampaignStatus,
): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new InvalidCampaignTransitionError(from, to);
  }
}
