// chatia-backend/src/conversations/types/conversation.types.ts
// Tipos de salida del ConversationsService hacia controllers y gRPC.
// Nunca exponer tipos Prisma crudos fuera del service. — ADR-007
import type {
  ConversationStatus,
  ConversationStage,
  ChannelType,
} from '@prisma/client';

export interface ConversationOutput {
  id:               string;
  status:           ConversationStatus;
  stage:            ConversationStage;
  isAiActive:       boolean;
  assignedAgentId:  string | null;
  lastMessageAt:    Date | null;
  resolvedAt:       Date | null;
  createdAt:        Date;
  updatedAt:        Date;
  // relaciones opcionales — solo cuando se piden con include
  contact?: {
    id:          string;
    externalId:  string;
    name:        string | null;
    channelType: ChannelType;
  };
  lastMessage?: {
    id:        string;
    content:   string;
    direction: 'INBOUND' | 'OUTBOUND';
    createdAt: Date;
  } | null;
}

export interface ConversationListOutput {
  items: ConversationOutput[];
  total: number;
  page:  number;
  limit: number;
}
