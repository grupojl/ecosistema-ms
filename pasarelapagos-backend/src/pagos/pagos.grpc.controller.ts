import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { PagosService } from "./pagos.service";

// Implementa el contrato definido en packages/proto/proto/pagos.proto
@Controller()
export class PagosGrpcController {
  constructor(private readonly svc: PagosService) {}

  @GrpcMethod("PagosService", "CreatePaymentIntent")
  async createPaymentIntent(data: {
    organization_id: string;
    ecosystem_id:    string;
    amount_cents:    number;
    currency:        string;
    description:     string;
    metadata_json:   string;
  }) {
    const result = await this.svc.createPaymentIntent({
      organizationId: data.organization_id,
      ecosystemId:    data.ecosystem_id,
      amountCents:    data.amount_cents,
      currency:       data.currency,
      description:    data.description,
    });
    return {
      success:       result.success,
      payment_id:    result.paymentId,
      client_secret: result.clientSecret,
      status:        result.status,
      error:         "",
    };
  }

  @GrpcMethod("PagosService", "GetPaymentStatus")
  async getPaymentStatus(data: { payment_id: string; organization_id: string }) {
    const payment = await this.svc.getPaymentStatus(data.payment_id, data.organization_id);
    if (!payment) return { found: false, status: "", amount_cents: 0, currency: "" };
    return {
      found:       true,
      status:      payment.status,
      amount_cents: payment.amountMinor,
      currency:    payment.currency,
    };
  }

  @GrpcMethod("PagosService", "Ping")
  ping(data: { caller: string }) {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
