import { CampaignStatus } from '@prisma/client';
// workers-backend/src/campaigns/dto/campaign.dto.ts

import {
  IsString, IsEnum, IsOptional,
  IsDateString, IsArray, IsObject,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()  ecosystemId!:    string;
  @IsString()  organizationId!: string;
  @IsString()  templateKey!:    string;
  @IsArray()   @IsString({ each: true }) recipientIds!: string[];
  @IsObject()  @IsOptional() variables?: Record<string, string>;
  @IsDateString() @IsOptional() scheduledAt?: string;
}

export class PatchCampaignDto {
  @IsEnum(['PAUSED', 'SCHEDULED', 'CANCELLED'])
  @IsOptional()
  status?: 'PAUSED' | 'SCHEDULED' | 'CANCELLED';

  @IsDateString() @IsOptional() scheduledAt?: string;
}
