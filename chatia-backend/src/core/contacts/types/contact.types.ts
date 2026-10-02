// chatia-backend/src/contacts/types/contact.types.ts
// Tipos de salida del ContactsService. — ADR-007
import type { ContactStatus, ChannelType } from '@prisma/client';

export interface ContactOutput {
  id:             string;
  organizationId: string;
  channelType:    ChannelType;
  externalId:     string;
  name:           string | null;
  email:          string | null;
  phone:          string | null;
  avatarUrl:      string | null;
  username:       string | null;
  status:         ContactStatus;
  optedOut:       boolean;
  tags:           string[];
  firstSeenAt:    Date;
  lastSeenAt:     Date;
  createdAt:      Date;
}

export interface ContactStatsOutput {
  total:    number;
  active:   number;
  blocked:  number;
  optedOut: number;
}
