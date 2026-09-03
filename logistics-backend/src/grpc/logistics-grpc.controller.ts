// logistics-grpc.controller.ts
// Implementa el contrato proto/logistics.proto
import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod }         from '@nestjs/microservices';
import { ShippingService }    from '../shipping/shipping.service.js';
import { DeliveryService }    from '../delivery/delivery.service.js';
import { WarehouseService }   from '../warehouse/warehouse.service.js';

@Controller()
export class LogisticsGrpcController {
  private readonly logger = new Logger(LogisticsGrpcController.name);

  constructor(
    private readonly shipping:  ShippingService,
    private readonly delivery:  DeliveryService,
    private readonly warehouse: WarehouseService,
  ) {}

  // ── Shipping ──────────────────────────────────────────────────────────────

  @GrpcMethod('LogisticsService', 'CreateShipment')
  async createShipment(req: any) {
    try {
      const s = await this.shipping.create(req.organization_id, req.ecosystem_id, {
        orderId: req.order_id, carrier: req.carrier,
        weightGrams: req.weight_grams, lengthCm: req.length_cm,
        widthCm: req.width_cm, heightCm: req.height_cm,
        street: req.street, city: req.city, province: req.province,
        zipCode: req.zip_code, country: req.country, notes: req.notes,
      });
      return { success: true, shipment_id: s.id, status: s.status, tracking_number: s.trackingNumber ?? '', error: '' };
    } catch (e: unknown) { return { success: false, shipment_id: '', status: '', tracking_number: '', error: String(e) }; }
  }

  @GrpcMethod('LogisticsService', 'CancelShipment')
  async cancelShipment(req: any) {
    try {
      const s = await this.shipping.cancel(req.organization_id, req.shipment_id);
      return { success: true, shipment_id: s.id, status: s.status, tracking_number: s.trackingNumber ?? '', error: '' };
    } catch (e: unknown) { return { success: false, shipment_id: '', status: '', tracking_number: '', error: String(e) }; }
  }

  @GrpcMethod('LogisticsService', 'GetShipment')
  async getShipment(req: any) {
    try {
      const s = await this.shipping.get(req.organization_id, req.shipment_id);
      return { success: true, shipment_id: s.id, status: s.status, tracking_number: s.trackingNumber ?? '', error: '' };
    } catch (e: unknown) { return { success: false, shipment_id: '', status: '', tracking_number: '', error: String(e) }; }
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  @GrpcMethod('LogisticsService', 'CreateDelivery')
  async createDelivery(req: any) {
    try {
      const d = await this.delivery.create(req.organization_id, req.ecosystem_id, {
        orderId: req.order_id, provider: req.provider, vehicleType: req.vehicle_type,
        originStreet: req.origin_street, originCity: req.origin_city,
        originLat: req.origin_lat, originLng: req.origin_lng,
        destStreet: req.dest_street, destCity: req.dest_city,
        destLat: req.dest_lat, destLng: req.dest_lng, notes: req.notes,
      });
      return { success: true, delivery_id: d.id, status: d.status, rider_name: d.riderName ?? '', error: '' };
    } catch (e: unknown) { return { success: false, delivery_id: '', status: '', rider_name: '', error: String(e) }; }
  }

  @GrpcMethod('LogisticsService', 'CancelDelivery')
  async cancelDelivery(req: any) {
    try {
      const d = await this.delivery.cancel(req.organization_id, req.delivery_id);
      return { success: true, delivery_id: d.id, status: d.status, rider_name: d.riderName ?? '', error: '' };
    } catch (e: unknown) { return { success: false, delivery_id: '', status: '', rider_name: '', error: String(e) }; }
  }

  @GrpcMethod('LogisticsService', 'GetDelivery')
  async getDelivery(req: any) {
    try {
      const d = await this.delivery.get(req.organization_id, req.delivery_id);
      return { success: true, delivery_id: d.id, status: d.status, rider_name: d.riderName ?? '', error: '' };
    } catch (e: unknown) { return { success: false, delivery_id: '', status: '', rider_name: '', error: String(e) }; }
  }

  // ── Warehouse ─────────────────────────────────────────────────────────────

  @GrpcMethod('LogisticsService', 'SetStock')
  async setStock(req: any) {
    try {
      const s = await this.warehouse.setStock(req.organization_id, req.ecosystem_id, req.location_id, req.variant_id, req.quantity);
      return { success: true, location_id: s.locationId, variant_id: s.variantId, quantity: s.quantity, reserved: s.reserved, error: '' };
    } catch (e: unknown) { return { success: false, location_id: '', variant_id: '', quantity: 0, reserved: 0, error: String(e) }; }
  }

  @GrpcMethod('LogisticsService', 'GetStock')
  async getStock(req: any) {
    try {
      const s = await this.warehouse.getStock(req.organization_id, req.location_id, req.variant_id);
      if (!s) return { success: false, location_id: req.location_id, variant_id: req.variant_id, quantity: 0, reserved: 0, error: 'Stock not found' };
      return { success: true, location_id: s.locationId, variant_id: s.variantId, quantity: s.quantity, reserved: s.reserved, error: '' };
    } catch (e: unknown) { return { success: false, location_id: '', variant_id: '', quantity: 0, reserved: 0, error: String(e) }; }
  }

  // ── Health ────────────────────────────────────────────────────────────────

  @GrpcMethod('LogisticsService', 'Ping')
  ping(req: { caller: string }) {
    this.logger.debug(`Ping from ${req.caller}`);
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
