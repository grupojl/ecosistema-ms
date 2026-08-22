import { Controller, Logger } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { AnalyticsService } from "../analytics/analytics.service.js";
@Controller()
export class AnalyticsGrpcController {
  private readonly logger = new Logger(AnalyticsGrpcController.name);
  constructor(private readonly svc: AnalyticsService) {}
  @GrpcMethod("AnalyticsService", "TrackEvent")
  async trackEvent(data: { ecosystem_id:string; organization_id:string; event_type:string; occurred_at:string; payload_json:Buffer }) {
    const event = const result = await this.svc.persistEvent({ ecosystemId: data.ecosystem_id, organizationId: data.organization_id, eventType: data.event_type, payload: JSON.parse(data.payload_json.toString()), occurredAt: new Date(parseInt(data.occurred_at)) });
    return { accepted: true, event_id: result?.id ?? "" };
  }
  @GrpcMethod("AnalyticsService", "GetOverview")
  async getOverview(data: { ecosystem_id:string; organization_id:string; from_unix:string; to_unix:string }) {
    return this.svc.getOverview({ ecosystemId: data.ecosystem_id, organizationId: data.organization_id, from: new Date(parseInt(data.from_unix)), to: new Date(parseInt(data.to_unix)) });
  }
  @GrpcMethod("AnalyticsService", "Ping")
  ping(data: { from:string }) { return { pong: "analytics-backend", timestamp_unix: Date.now() }; }
}
