// analytics-backend/src/grpc/analytics-grpc.controller.ts
import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod }         from '@nestjs/microservices';
import { AnalyticsService }   from '../analytics/analytics.service.js';

interface TrackEventRequest {
  ecosystem_id:    string;
  organization_id: string;
  event_type:      string;
  occurred_at:     number;
  payload_json:    Buffer | string;
}

interface OverviewRequest {
  ecosystem_id:    string;
  organization_id: string;
  from_unix:       number;
  to_unix:         number;
}

interface AgentMetricsRequest {
  ecosystem_id:    string;
  organization_id: string;
  from_unix:       number;
  to_unix:         number;
  page?:           number;
  page_size?:      number;
}

interface ConvByDayRequest {
  ecosystem_id:    string;
  organization_id: string;
  from_unix:       number;
  to_unix:         number;
}

@Controller()
export class AnalyticsGrpcController {
  private readonly logger = new Logger(AnalyticsGrpcController.name);

  constructor(private readonly svc: AnalyticsService) {}

  @GrpcMethod('AnalyticsService', 'TrackEvent')
  async trackEvent(data: TrackEventRequest) {
    try {
      const payload = JSON.parse(
        typeof data.payload_json === 'string'
          ? data.payload_json
          : data.payload_json.toString(),
      ) as Record<string, unknown>;

      const result = await this.svc.persistEvent({
        ecosystemId:    data.ecosystem_id,
        organizationId: data.organization_id,
        eventType:      data.event_type,
        payload,
        occurredAt: new Date(parseInt(String(data.occurred_at))),
      });

      return { accepted: true, event_id: result?.id ?? '' };
    } catch (e: unknown) {
      this.logger.error(`TrackEvent error: ${String(e)}`);
      return { accepted: false, event_id: '' };
    }
  }

  @GrpcMethod('AnalyticsService', 'GetOverview')
  async getOverview(data: OverviewRequest) {
    return this.svc.getOverview({
      ecosystemId:    data.ecosystem_id,
      organizationId: data.organization_id,
      from: new Date(data.from_unix * 1_000),
      to:   new Date(data.to_unix   * 1_000),
    });
  }

  @GrpcMethod('AnalyticsService', 'GetConversationsByDay')
  async getConversationsByDay(data: ConvByDayRequest) {
    return this.svc.getConversationsByDay(
      data.organization_id,
      new Date(data.from_unix * 1_000),
      new Date(data.to_unix   * 1_000),
    );
  }

  @GrpcMethod('AnalyticsService', 'GetAgentMetrics')
  async getAgentMetrics(data: AgentMetricsRequest) {
    return this.svc.getAgentMetrics({
      ecosystemId:    data.ecosystem_id,
      organizationId: data.organization_id,
      from:  new Date(data.from_unix * 1_000),
      to:    new Date(data.to_unix   * 1_000),
      page:  data.page,
      limit: data.page_size,
    });
  }

  @GrpcMethod('AnalyticsService', 'Ping')
  ping(data: { from: string }) {
    this.logger.debug(`Ping desde: ${data.from}`);
    return { pong: 'analytics-backend', timestamp_unix: Date.now() };
  }
}
