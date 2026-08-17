// workers-backend/src/jobs/dto/campaign-email-job.dto.ts

export interface CampaignEmailJobData {
  ecosystemId:    string;
  organizationId: string;
  campaignId:     string;
  recipientIds:   string[];    // contactIds a notificar
  templateKey:    string;
  variables?:     Record<string, string>; // variables globales del template
  /** Cursor de progreso — si falla a mitad, retry desde cursor */
  cursor?:        number;
}

export interface CampaignEmailJobResult {
  campaignId:  string;
  totalSent:   number;
  totalFailed: number;
  durationMs:  number;
}
