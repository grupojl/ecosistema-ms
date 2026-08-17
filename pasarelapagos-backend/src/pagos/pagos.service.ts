import { Injectable, Logger } from "@nestjs/common";
import { PrismaService }      from "../prisma/prisma.service";

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(private readonly prisma: PrismaService) {}

  // TODO: implementar lógica de pagos (MercadoPago / Stripe)
  async createPaymentIntent(params: {
    organizationId: string;
    ecosystemId:    string;
    amountCents:    number;
    currency:       string;
    description?:   string;
  }) {
    this.logger.log(`Creando pago para org ${params.organizationId}`);
    // Placeholder hasta implementar la pasarela
    return {
      success:      true,
      paymentId:    `pay_${Date.now()}`,
      clientSecret: "placeholder",
      status:       "PENDING",
    };
  }

  async getPaymentStatus(paymentId: string, organizationId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
    });
    return payment;
  }
}
