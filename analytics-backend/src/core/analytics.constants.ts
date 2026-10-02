// analytics-backend/src/analytics/analytics.constants.ts

export const ANALYTICS_EVENTS_QUEUE  = 'analytics.events';
export const ANALYTICS_EXPORT_QUEUE  = 'workers.analytics-export';

export const EVENT_TYPES = {
  CONVERSATION_CREATED:           'conversation.created',
  CONVERSATION_RESOLVED:          'conversation.resolved',
  CONVERSATION_ESCALATED:         'conversation.escalated',
  CONVERSATION_ASSIGNED:          'conversation.assigned',
  CONVERSATION_RESOLVED_BY_AGENT: 'conversation.resolved_by_agent',
  MESSAGE_SENT:                   'message.sent',
  MESSAGE_RESPONSE_TIME:          'message.response_time',
  AGENT_RESPONSE_TIME:            'agent.response_time',
} as const;

export type AnalyticsEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
