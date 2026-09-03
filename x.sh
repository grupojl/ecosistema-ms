#!/usr/bin/env bash
# =============================================================================
# x.sh — Crear logistics-backend en ecosistema-ms
#
# Patrones copiados de: notificaciones-backend + analytics-backend
# Stack: NestJS 11 · Prisma 7 · gRPC · BullMQ · Firebase Admin
# Auth: @ecosistema-ms/auth-server
# Puertos: HTTP 3005 · gRPC 5006
# Sin python, sin perl — bash puro.
#
# Uso: bash x.sh (desde la raíz del monorepo ecosistema-ms/)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
die()  { echo -e "\n${RED}✗ ERROR: $1${NC}"; exit 1; }

[[ -f "pnpm-workspace.yaml" ]] || die "Correr desde la raíz del monorepo ecosistema-ms/"

SVC="logistics-backend"
[[ -d "$SVC" ]] && die "$SVC ya existe — eliminalo primero si querés regenerarlo"

step "Creando estructura de directorios"
mkdir -p "$SVC"/{prisma,proto,src/{common/{filters,interceptors},prisma,health,grpc,metrics,shipping/{domain,repository},delivery/{domain,repository},warehouse/{domain,repository}}}
ok "Directorios creados"

# =============================================================================
# railway.json
# =============================================================================
step "railway.json"
cat > "$SVC/railway.json" << 'ENDOFFILE'
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "logistics-backend/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
ENDOFFILE
ok "railway.json"

# =============================================================================
# nest-cli.json
# =============================================================================
cat > "$SVC/nest-cli.json" << 'ENDOFFILE'
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
ENDOFFILE
ok "nest-cli.json"

# =============================================================================
# tsconfig.json
# =============================================================================
cat > "$SVC/tsconfig.json" << 'ENDOFFILE'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "baseUrl": "./"
  }
}
ENDOFFILE
ok "tsconfig.json"

# =============================================================================
# package.json — mismo patrón que notificaciones-backend / analytics-backend
# =============================================================================
step "package.json"
cat > "$SVC/package.json" << 'ENDOFFILE'
{
  "name": "logistics-backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "prisma generate && nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:migrate": "prisma migrate deploy && node dist/main",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:cov": "jest --coverage"
  },
  "dependencies": {
    "@ecosistema-ms/auth-server": "workspace:*",
    "@ecosistema-ms/grpc-client": "workspace:*",
    "@ecosistema-ms/proto": "workspace:*",
    "@grpc/grpc-js": "catalog:",
    "@grpc/proto-loader": "catalog:",
    "@nestjs/bullmq": "catalog:",
    "@nestjs/common": "catalog:",
    "@nestjs/config": "catalog:",
    "@nestjs/core": "catalog:",
    "@nestjs/microservices": "catalog:",
    "@nestjs/platform-express": "catalog:",
    "@nestjs/schedule": "catalog:",
    "@nestjs/swagger": "catalog:",
    "@nestjs/terminus": "catalog:",
    "@prisma/adapter-pg": "catalog:",
    "@prisma/client": "catalog:",
    "bullmq": "catalog:",
    "class-transformer": "catalog:",
    "class-validator": "catalog:",
    "dotenv": "catalog:",
    "firebase-admin": "catalog:",
    "helmet": "catalog:",
    "ioredis": "catalog:",
    "nestjs-pino": "catalog:",
    "pg": "catalog:",
    "pino": "catalog:",
    "pino-http": "catalog:",
    "prisma": "catalog:",
    "protobufjs": "catalog:",
    "reflect-metadata": "catalog:",
    "rxjs": "catalog:",
    "swagger-ui-express": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@nestjs/cli": "catalog:",
    "@nestjs/schematics": "catalog:",
    "@nestjs/testing": "catalog:",
    "@types/node": "catalog:",
    "jest": "catalog:",
    "supertest": "catalog:",
    "ts-jest": "catalog:",
    "ts-node": "catalog:",
    "tsconfig-paths": "catalog:",
    "typescript": "catalog:"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "coverageThreshold": { "global": { "lines": 85 } },
    "testEnvironment": "node"
  }
}
ENDOFFILE
ok "package.json"

# =============================================================================
# .env.example
# =============================================================================
step ".env.example"
cat > "$SVC/.env.example" << 'ENDOFFILE'
# Puerto HTTP
PORT=3005

# Puerto gRPC
GRPC_PORT=5006

# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/logistics_db

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# URLs gRPC de otros servicios
# Local
CHATIA_GRPC_URL=localhost:5001
NOTIF_GRPC_URL=localhost:5003
ANALYTICS_GRPC_URL=localhost:5004
# Railway (red privada)
# CHATIA_GRPC_URL=chatia-backend.railway.internal:5001
# NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003
# ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
ENDOFFILE
ok ".env.example"

# =============================================================================
# proto/logistics.proto
# =============================================================================
step "proto/logistics.proto"
cat > "$SVC/proto/logistics.proto" << 'ENDOFFILE'
syntax = "proto3";

package logistics;

// ─── Servicio Logistics ────────────────────────────────────────────────────
// Puerto gRPC interno: 5006
// Usado por: chatia-backend, workers-backend, pasarelapagos-backend
service LogisticsService {
  // Shipping
  rpc CreateShipment  (CreateShipmentRequest)  returns (ShipmentResponse);
  rpc CancelShipment  (ShipmentIdRequest)       returns (ShipmentResponse);
  rpc GetShipment     (ShipmentIdRequest)       returns (ShipmentResponse);
  // Delivery
  rpc CreateDelivery  (CreateDeliveryRequest)   returns (DeliveryResponse);
  rpc CancelDelivery  (DeliveryIdRequest)        returns (DeliveryResponse);
  rpc GetDelivery     (DeliveryIdRequest)        returns (DeliveryResponse);
  // Warehouse
  rpc SetStock        (SetStockRequest)          returns (StockResponse);
  rpc GetStock        (GetStockRequest)          returns (StockResponse);
  // Health
  rpc Ping            (PingRequest)              returns (PingResponse);
}

// ─── Shipping ───────────────────────────────────────────────────────────────

message CreateShipmentRequest {
  string organization_id = 1;
  string ecosystem_id    = 2;
  string order_id        = 3;
  string carrier         = 4; // CORREO_ARGENTINO | OCA | ANDREANI | CUSTOM
  int32  weight_grams    = 5;
  double length_cm       = 6;
  double width_cm        = 7;
  double height_cm       = 8;
  string street          = 9;
  string city            = 10;
  string province        = 11;
  string zip_code        = 12;
  string country         = 13;
  string notes           = 14;
}

message ShipmentIdRequest {
  string organization_id = 1;
  string shipment_id     = 2;
}

message ShipmentResponse {
  bool   success        = 1;
  string shipment_id    = 2;
  string status         = 3;
  string tracking_number = 4;
  string error          = 5;
}

// ─── Delivery ───────────────────────────────────────────────────────────────

message CreateDeliveryRequest {
  string organization_id = 1;
  string ecosystem_id    = 2;
  string order_id        = 3;
  string provider        = 4; // WELIVERY | ENVIA | CUSTOM
  string vehicle_type    = 5; // MOTO | BICI | AUTO | CAMIONETA
  string origin_street   = 6;
  string origin_city     = 7;
  double origin_lat      = 8;
  double origin_lng      = 9;
  string dest_street     = 10;
  string dest_city       = 11;
  double dest_lat        = 12;
  double dest_lng        = 13;
  string notes           = 14;
}

message DeliveryIdRequest {
  string organization_id = 1;
  string delivery_id     = 2;
}

message DeliveryResponse {
  bool   success     = 1;
  string delivery_id = 2;
  string status      = 3;
  string rider_name  = 4;
  string error       = 5;
}

// ─── Warehouse ──────────────────────────────────────────────────────────────

message SetStockRequest {
  string organization_id = 1;
  string ecosystem_id    = 2;
  string location_id     = 3;
  string variant_id      = 4;
  int32  quantity        = 5;
}

message GetStockRequest {
  string organization_id = 1;
  string location_id     = 2;
  string variant_id      = 3;
}

message StockResponse {
  bool   success     = 1;
  string location_id = 2;
  string variant_id  = 3;
  int32  quantity    = 4;
  int32  reserved    = 5;
  string error       = 6;
}

// ─── Common ─────────────────────────────────────────────────────────────────

message PingRequest  { string caller = 1; }
message PingResponse { string status = 1; string timestamp = 2; }
ENDOFFILE
ok "proto/logistics.proto"

# =============================================================================
# prisma/schema.prisma
# =============================================================================
step "prisma/schema.prisma"
cat > "$SVC/prisma/schema.prisma" << 'ENDOFFILE'
// prisma/schema.prisma — logistics-backend
// 3 bounded contexts: Shipping · Delivery · Warehouse

generator client {
  provider   = "prisma-client-js"
  engineType = "client"
}

datasource db {
  provider = "postgresql"
}

// ─── SHIPPING ────────────────────────────────────────────────────────────────

enum ShipmentStatus {
  PENDING
  IN_TRANSIT
  DELIVERED
  CANCELLED
  RETURNED
}

enum ShipmentCarrier {
  CORREO_ARGENTINO
  OCA
  ANDREANI
  CUSTOM
}

model Shipment {
  id             String          @id @default(uuid())
  ecosystemId    String          @map("ecosystem_id")
  organizationId String          @map("organization_id")
  orderId        String?         @map("order_id")
  carrier        ShipmentCarrier
  trackingNumber String?         @map("tracking_number")
  status         ShipmentStatus  @default(PENDING)
  weightGrams    Int             @map("weight_grams")
  lengthCm       Decimal         @map("length_cm") @db.Decimal(8, 2)
  widthCm        Decimal         @map("width_cm")  @db.Decimal(8, 2)
  heightCm       Decimal         @map("height_cm") @db.Decimal(8, 2)
  street         String
  city           String
  province       String
  zipCode        String          @map("zip_code")
  country        String          @default("AR")
  costCents      Int?            @map("cost_cents")
  currency       String          @default("ARS")
  labelUrl       String?         @map("label_url")
  notes          String?
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt      @map("updated_at")
  cancelledAt    DateTime?       @map("cancelled_at")
  deliveredAt    DateTime?       @map("delivered_at")

  @@index([ecosystemId, organizationId])
  @@index([ecosystemId, organizationId, orderId])
  @@index([ecosystemId, organizationId, status])
  @@map("shipments")
}

// ─── DELIVERY ────────────────────────────────────────────────────────────────

enum DeliveryStatus {
  PENDING
  ASSIGNED
  PICKED_UP
  IN_TRANSIT
  DELIVERED
  CANCELLED
  FAILED
}

enum DeliveryProvider {
  WELIVERY
  ENVIA
  CUSTOM
}

enum VehicleType {
  MOTO
  BICI
  AUTO
  CAMIONETA
}

model DeliveryOrder {
  id             String           @id @default(uuid())
  ecosystemId    String           @map("ecosystem_id")
  organizationId String           @map("organization_id")
  orderId        String?          @map("order_id")
  provider       DeliveryProvider
  externalId     String?          @map("external_id")
  status         DeliveryStatus   @default(PENDING)
  vehicleType    VehicleType      @default(MOTO) @map("vehicle_type")
  originStreet   String           @map("origin_street")
  originCity     String           @map("origin_city")
  originLat      Decimal?         @map("origin_lat") @db.Decimal(10, 7)
  originLng      Decimal?         @map("origin_lng") @db.Decimal(10, 7)
  destStreet     String           @map("dest_street")
  destCity       String           @map("dest_city")
  destLat        Decimal?         @map("dest_lat") @db.Decimal(10, 7)
  destLng        Decimal?         @map("dest_lng") @db.Decimal(10, 7)
  riderName      String?          @map("rider_name")
  riderPhone     String?          @map("rider_phone")
  distanceKm     Decimal?         @map("distance_km") @db.Decimal(8, 2)
  costCents      Int?             @map("cost_cents")
  currency       String           @default("ARS")
  notes          String?
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt      @map("updated_at")
  pickedUpAt     DateTime?        @map("picked_up_at")
  deliveredAt    DateTime?        @map("delivered_at")
  cancelledAt    DateTime?        @map("cancelled_at")

  @@index([ecosystemId, organizationId])
  @@index([ecosystemId, organizationId, orderId])
  @@index([ecosystemId, organizationId, status])
  @@map("delivery_orders")
}

// ─── WAREHOUSE ───────────────────────────────────────────────────────────────

model WarehouseLocation {
  id             String           @id @default(uuid())
  ecosystemId    String           @map("ecosystem_id")
  organizationId String           @map("organization_id")
  name           String
  code           String
  depot          String
  aisle          String?
  shelf          String?
  capacityUnits  Int              @map("capacity_units")
  isActive       Boolean          @default(true) @map("is_active")
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt      @map("updated_at")
  stocks         WarehouseStock[]

  @@unique([organizationId, code])
  @@index([ecosystemId, organizationId])
  @@index([ecosystemId, organizationId, depot])
  @@map("warehouse_locations")
}

model WarehouseStock {
  id             String            @id @default(uuid())
  ecosystemId    String            @map("ecosystem_id")
  organizationId String            @map("organization_id")
  locationId     String            @map("location_id")
  variantId      String            @map("variant_id")
  quantity       Int               @default(0)
  reserved       Int               @default(0)
  createdAt      DateTime          @default(now()) @map("created_at")
  updatedAt      DateTime          @updatedAt      @map("updated_at")
  location       WarehouseLocation @relation(fields: [locationId], references: [id])

  @@unique([locationId, variantId])
  @@index([ecosystemId, organizationId])
  @@index([ecosystemId, organizationId, variantId])
  @@map("warehouse_stock")
}
ENDOFFILE
ok "prisma/schema.prisma"

# =============================================================================
# src/prisma/
# =============================================================================
step "src/prisma/"
cat > "$SVC/src/prisma/prisma.module.ts" << 'ENDOFFILE'
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
ENDOFFILE

cat > "$SVC/src/prisma/prisma.service.ts" << 'ENDOFFILE'
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg }    from '@prisma/adapter-pg';
import { Pool }        from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const pool    = new Pool({ connectionString: process.env['DATABASE_URL'] });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma conectado — logistics_db');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
ENDOFFILE
ok "src/prisma/"

# =============================================================================
# src/health/
# =============================================================================
step "src/health/"
cat > "$SVC/src/health/health.module.ts" << 'ENDOFFILE'
import { Module }           from '@nestjs/common';
import { TerminusModule }   from '@nestjs/terminus';
import { HealthController } from './health.controller.js';

@Module({ imports: [TerminusModule], controllers: [HealthController] })
export class HealthModule {}
ENDOFFILE

cat > "$SVC/src/health/health.controller.ts" << 'ENDOFFILE'
import { Controller, Get }                               from '@nestjs/common';
import { SetMetadata }                                   from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';

const Public = () => SetMetadata('isPublic', true);

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' as const } };
        } catch (e: unknown) {
          return { database: { status: 'down' as const, error: String(e) } };
        }
      },
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
ENDOFFILE
ok "src/health/"

# =============================================================================
# src/metrics/
# =============================================================================
step "src/metrics/"
cat > "$SVC/src/metrics/metrics.module.ts" << 'ENDOFFILE'
import { Module }          from '@nestjs/common';
import { MetricsService }  from './metrics.service.js';
import { MetricsController } from './metrics.controller.js';

@Module({ providers: [MetricsService], controllers: [MetricsController], exports: [MetricsService] })
export class MetricsModule {}
ENDOFFILE

cat > "$SVC/src/metrics/metrics.service.ts" << 'ENDOFFILE'
import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();

  increment(key: string, value = 1): void {
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }
}
ENDOFFILE

cat > "$SVC/src/metrics/metrics.controller.ts" << 'ENDOFFILE'
import { Controller, Get } from '@nestjs/common';
import { SetMetadata }     from '@nestjs/common';
import { MetricsService }  from './metrics.service.js';

const Public = () => SetMetadata('isPublic', true);

@Controller('api/v1/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Public()
  snapshot() { return this.metrics.snapshot(); }
}
ENDOFFILE
ok "src/metrics/"

# =============================================================================
# src/common/filters/
# =============================================================================
step "src/common/filters/"
cat > "$SVC/src/common/filters/http-exception.filter.ts" << 'ENDOFFILE'
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    if (status >= 500) this.logger.error({ path: req.url, status, message });

    res.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
ENDOFFILE
ok "src/common/filters/"

# =============================================================================
# SHIPPING — domain
# =============================================================================
step "src/shipping/domain/"
cat > "$SVC/src/shipping/domain/shipment.errors.ts" << 'ENDOFFILE'
// 0 imports de NestJS/Prisma — errores de dominio puros
export abstract class DomainError extends Error {
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class InvalidWeightError       extends DomainError {
  constructor(g: number) { super(`Peso inválido: ${g}g — debe ser > 0`); }
}
export class InvalidDimensionsError   extends DomainError {
  constructor(f: string, v: number) { super(`Dimensión inválida: ${f}=${v} — debe ser > 0`); }
}
export class ShipmentAlreadyCancelledError extends DomainError {
  constructor() { super('El envío ya fue cancelado'); }
}
export class ShipmentAlreadyDeliveredError extends DomainError {
  constructor() { super('No se puede cancelar un envío ya entregado'); }
}
export class InvalidTrackingNumberError extends DomainError {
  constructor(t: string) { super(`Tracking inválido: "${t}"`); }
}
ENDOFFILE

cat > "$SVC/src/shipping/domain/shipment.entity.ts" << 'ENDOFFILE'
// Funciones puras — 0 side effects, 0 imports de infraestructura
import {
  InvalidWeightError, InvalidDimensionsError,
  ShipmentAlreadyCancelledError, ShipmentAlreadyDeliveredError,
  InvalidTrackingNumberError,
} from './shipment.errors.js';

export type ShipmentStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export interface ShipmentDimensions { lengthCm: number; widthCm: number; heightCm: number; }

export function assertValidWeight(g: number): void {
  if (g <= 0) throw new InvalidWeightError(g);
}
export function assertValidDimensions(d: ShipmentDimensions): void {
  if (d.lengthCm <= 0) throw new InvalidDimensionsError('lengthCm', d.lengthCm);
  if (d.widthCm  <= 0) throw new InvalidDimensionsError('widthCm',  d.widthCm);
  if (d.heightCm <= 0) throw new InvalidDimensionsError('heightCm', d.heightCm);
}
export function assertCanCancel(status: ShipmentStatus): void {
  if (status === 'DELIVERED') throw new ShipmentAlreadyDeliveredError();
  if (status === 'CANCELLED') throw new ShipmentAlreadyCancelledError();
}
export function assertValidTracking(t: string): void {
  if (!t || t.trim().length < 4) throw new InvalidTrackingNumberError(t);
}
export function volumetricWeightGrams(d: ShipmentDimensions): number {
  return Math.ceil((d.lengthCm * d.widthCm * d.heightCm) / 5);
}
export function effectiveWeightGrams(actual: number, d: ShipmentDimensions): number {
  return Math.max(actual, volumetricWeightGrams(d));
}
ENDOFFILE
ok "src/shipping/domain/"

# =============================================================================
# SHIPPING — repository
# =============================================================================
step "src/shipping/repository/"
cat > "$SVC/src/shipping/repository/shipment.repository.interface.ts" << 'ENDOFFILE'
import type { ShipmentStatus } from '../domain/shipment.entity.js';

export const SHIPMENT_REPOSITORY = 'SHIPMENT_REPOSITORY';

export interface ShipmentRecord {
  id: string; ecosystemId: string; organizationId: string; orderId: string | null;
  carrier: string; trackingNumber: string | null; status: ShipmentStatus;
  weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  street: string; city: string; province: string; zipCode: string; country: string;
  costCents: number | null; currency: string; labelUrl: string | null; notes: string | null;
  createdAt: Date; updatedAt: Date; cancelledAt: Date | null; deliveredAt: Date | null;
}
export interface CreateShipmentData {
  ecosystemId: string; orderId?: string; carrier: string;
  weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  street: string; city: string; province: string; zipCode: string; country?: string; notes?: string;
}
export interface ShipmentRepository {
  findById(organizationId: string, id: string): Promise<ShipmentRecord | null>;
  list(organizationId: string, filter: { orderId?: string; status?: ShipmentStatus; limit?: number }): Promise<ShipmentRecord[]>;
  create(organizationId: string, data: CreateShipmentData): Promise<ShipmentRecord>;
  updateStatus(organizationId: string, id: string, status: ShipmentStatus, extra?: Partial<ShipmentRecord>): Promise<ShipmentRecord>;
}
ENDOFFILE

cat > "$SVC/src/shipping/repository/prisma-shipment.repository.ts" << 'ENDOFFILE'
// Único archivo del módulo que puede importar PrismaService
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ShipmentStatus } from '../domain/shipment.entity.js';
import type { ShipmentRepository, ShipmentRecord, CreateShipmentData } from './shipment.repository.interface.js';

const toRecord = (s: any): ShipmentRecord => ({
  ...s,
  lengthCm: Number(s.lengthCm), widthCm: Number(s.widthCm), heightCm: Number(s.heightCm),
});

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string) {
    const s = await this.prisma.shipment.findFirst({ where: { id, organizationId } });
    return s ? toRecord(s) : null;
  }

  async list(organizationId: string, f: { orderId?: string; status?: ShipmentStatus; limit?: number }) {
    const rows = await this.prisma.shipment.findMany({
      where: { organizationId, ...(f.orderId ? { orderId: f.orderId } : {}), ...(f.status ? { status: f.status as any } : {}) },
      orderBy: { createdAt: 'desc' }, take: f.limit ?? 20,
    });
    return rows.map(toRecord);
  }

  async create(organizationId: string, data: CreateShipmentData) {
    const s = await this.prisma.shipment.create({
      data: { organizationId, ecosystemId: data.ecosystemId, orderId: data.orderId,
        carrier: data.carrier as any, weightGrams: data.weightGrams,
        lengthCm: data.lengthCm, widthCm: data.widthCm, heightCm: data.heightCm,
        street: data.street, city: data.city, province: data.province,
        zipCode: data.zipCode, country: data.country ?? 'AR', notes: data.notes },
    });
    return toRecord(s);
  }

  async updateStatus(organizationId: string, id: string, status: ShipmentStatus, extra: Partial<ShipmentRecord> = {}) {
    const s = await this.prisma.shipment.update({ where: { id }, data: { status: status as any, ...extra } });
    return toRecord(s);
  }
}
ENDOFFILE
ok "src/shipping/repository/"

# =============================================================================
# SHIPPING — service + module
# =============================================================================
cat > "$SVC/src/shipping/shipping.service.ts" << 'ENDOFFILE'
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { assertValidWeight, assertValidDimensions, assertCanCancel, assertValidTracking, effectiveWeightGrams } from './domain/shipment.entity.js';
import { DomainError } from './domain/shipment.errors.js';
import { SHIPMENT_REPOSITORY, type ShipmentRepository, type ShipmentRecord } from './repository/shipment.repository.interface.js';

@Injectable()
export class ShippingService {
  constructor(@Inject(SHIPMENT_REPOSITORY) private readonly repo: ShipmentRepository) {}

  async create(organizationId: string, ecosystemId: string, dto: {
    orderId?: string; carrier: string; weightGrams: number;
    lengthCm: number; widthCm: number; heightCm: number;
    street: string; city: string; province: string; zipCode: string;
    country?: string; notes?: string;
  }): Promise<ShipmentRecord> {
    try {
      assertValidWeight(dto.weightGrams);
      assertValidDimensions({ lengthCm: dto.lengthCm, widthCm: dto.widthCm, heightCm: dto.heightCm });
    } catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.create(organizationId, { ecosystemId, ...dto });
  }

  async cancel(organizationId: string, id: string): Promise<ShipmentRecord> {
    const s = await this.repo.findById(organizationId, id);
    if (!s) throw new NotFoundException(`Shipment ${id} not found`);
    try { assertCanCancel(s.status); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.updateStatus(organizationId, id, 'CANCELLED', { cancelledAt: new Date() });
  }

  async get(organizationId: string, id: string): Promise<ShipmentRecord> {
    const s = await this.repo.findById(organizationId, id);
    if (!s) throw new NotFoundException(`Shipment ${id} not found`);
    return s;
  }

  async updateTracking(organizationId: string, id: string, tracking: string): Promise<ShipmentRecord> {
    try { assertValidTracking(tracking); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    const s = await this.repo.findById(organizationId, id);
    if (!s) throw new NotFoundException(`Shipment ${id} not found`);
    return this.repo.updateStatus(organizationId, id, 'IN_TRANSIT', { trackingNumber: tracking });
  }

  estimateCost(weightGrams: number, dims: { lengthCm: number; widthCm: number; heightCm: number }): number {
    const ew = effectiveWeightGrams(weightGrams, dims);
    return 150000 + Math.ceil(ew / 100) * 5000; // stub — integrar con API de carrier
  }
}
ENDOFFILE

cat > "$SVC/src/shipping/shipping.module.ts" << 'ENDOFFILE'
import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service.js';
import { PrismaShipmentRepository } from './repository/prisma-shipment.repository.js';
import { SHIPMENT_REPOSITORY } from './repository/shipment.repository.interface.js';

@Module({
  providers: [ShippingService, { provide: SHIPMENT_REPOSITORY, useClass: PrismaShipmentRepository }],
  exports: [ShippingService],
})
export class ShippingModule {}
ENDOFFILE
ok "src/shipping/"

# =============================================================================
# DELIVERY — domain + repository + service + module
# =============================================================================
step "src/delivery/"
cat > "$SVC/src/delivery/domain/delivery-order.errors.ts" << 'ENDOFFILE'
export abstract class DomainError extends Error {
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class DeliveryAlreadyCancelledError extends DomainError { constructor() { super('Delivery ya cancelado'); } }
export class DeliveryAlreadyDeliveredError extends DomainError { constructor() { super('No se puede cancelar un delivery entregado'); } }
export class MissingOriginError extends DomainError { constructor() { super('El origen del delivery es requerido'); } }
ENDOFFILE

cat > "$SVC/src/delivery/domain/delivery-order.entity.ts" << 'ENDOFFILE'
import { DeliveryAlreadyCancelledError, DeliveryAlreadyDeliveredError, MissingOriginError } from './delivery-order.errors.js';
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'FAILED';
export function assertCanCancelDelivery(status: DeliveryStatus): void {
  if (status === 'DELIVERED') throw new DeliveryAlreadyDeliveredError();
  if (status === 'CANCELLED') throw new DeliveryAlreadyCancelledError();
}
export function assertHasOrigin(street: string): void {
  if (!street?.trim()) throw new MissingOriginError();
}
export function estimateDeliveryCost(distanceKm: number, vehicleType: string): number {
  const base: Record<string, number> = { MOTO: 80000, BICI: 60000, AUTO: 120000, CAMIONETA: 200000 };
  return (base[vehicleType] ?? 80000) + Math.ceil(distanceKm) * 10000; // stub
}
ENDOFFILE

cat > "$SVC/src/delivery/repository/delivery-order.repository.interface.ts" << 'ENDOFFILE'
import type { DeliveryStatus } from '../domain/delivery-order.entity.js';
export const DELIVERY_REPOSITORY = 'DELIVERY_REPOSITORY';
export interface DeliveryOrderRecord {
  id: string; ecosystemId: string; organizationId: string; orderId: string | null;
  provider: string; externalId: string | null; status: DeliveryStatus; vehicleType: string;
  originStreet: string; originCity: string; originLat: number | null; originLng: number | null;
  destStreet: string; destCity: string; destLat: number | null; destLng: number | null;
  riderName: string | null; riderPhone: string | null; distanceKm: number | null;
  costCents: number | null; currency: string; notes: string | null;
  createdAt: Date; updatedAt: Date; pickedUpAt: Date | null; deliveredAt: Date | null; cancelledAt: Date | null;
}
export interface CreateDeliveryData {
  ecosystemId: string; orderId?: string; provider: string; vehicleType?: string;
  originStreet: string; originCity: string; originLat?: number; originLng?: number;
  destStreet: string; destCity: string; destLat?: number; destLng?: number; notes?: string;
}
export interface DeliveryRepository {
  findById(organizationId: string, id: string): Promise<DeliveryOrderRecord | null>;
  list(organizationId: string, filter: { status?: DeliveryStatus; limit?: number }): Promise<DeliveryOrderRecord[]>;
  create(organizationId: string, data: CreateDeliveryData): Promise<DeliveryOrderRecord>;
  updateStatus(organizationId: string, id: string, status: DeliveryStatus, extra?: Partial<DeliveryOrderRecord>): Promise<DeliveryOrderRecord>;
}
ENDOFFILE

cat > "$SVC/src/delivery/repository/prisma-delivery-order.repository.ts" << 'ENDOFFILE'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DeliveryStatus } from '../domain/delivery-order.entity.js';
import type { DeliveryRepository, DeliveryOrderRecord, CreateDeliveryData } from './delivery-order.repository.interface.js';
const toRecord = (d: any): DeliveryOrderRecord => ({
  ...d, distanceKm: d.distanceKm ? Number(d.distanceKm) : null,
  originLat: d.originLat ? Number(d.originLat) : null, originLng: d.originLng ? Number(d.originLng) : null,
  destLat: d.destLat ? Number(d.destLat) : null, destLng: d.destLng ? Number(d.destLng) : null,
});
@Injectable()
export class PrismaDeliveryRepository implements DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findById(organizationId: string, id: string) {
    const d = await this.prisma.deliveryOrder.findFirst({ where: { id, organizationId } });
    return d ? toRecord(d) : null;
  }
  async list(organizationId: string, f: { status?: DeliveryStatus; limit?: number }) {
    const rows = await this.prisma.deliveryOrder.findMany({
      where: { organizationId, ...(f.status ? { status: f.status as any } : {}) },
      orderBy: { createdAt: 'desc' }, take: f.limit ?? 20,
    });
    return rows.map(toRecord);
  }
  async create(organizationId: string, data: CreateDeliveryData) {
    const d = await this.prisma.deliveryOrder.create({
      data: { organizationId, ecosystemId: data.ecosystemId, orderId: data.orderId,
        provider: data.provider as any, vehicleType: (data.vehicleType ?? 'MOTO') as any,
        originStreet: data.originStreet, originCity: data.originCity,
        originLat: data.originLat, originLng: data.originLng,
        destStreet: data.destStreet, destCity: data.destCity,
        destLat: data.destLat, destLng: data.destLng, notes: data.notes },
    });
    return toRecord(d);
  }
  async updateStatus(organizationId: string, id: string, status: DeliveryStatus, extra: Partial<DeliveryOrderRecord> = {}) {
    const d = await this.prisma.deliveryOrder.update({ where: { id }, data: { status: status as any, ...extra } });
    return toRecord(d);
  }
}
ENDOFFILE

cat > "$SVC/src/delivery/delivery.service.ts" << 'ENDOFFILE'
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { assertCanCancelDelivery, assertHasOrigin, estimateDeliveryCost } from './domain/delivery-order.entity.js';
import { DomainError } from './domain/delivery-order.errors.js';
import { DELIVERY_REPOSITORY, type DeliveryRepository, type DeliveryOrderRecord } from './repository/delivery-order.repository.interface.js';
@Injectable()
export class DeliveryService {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly repo: DeliveryRepository) {}
  async create(organizationId: string, ecosystemId: string, dto: { orderId?: string; provider: string; vehicleType?: string; originStreet: string; originCity: string; originLat?: number; originLng?: number; destStreet: string; destCity: string; destLat?: number; destLng?: number; notes?: string; }): Promise<DeliveryOrderRecord> {
    try { assertHasOrigin(dto.originStreet); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.create(organizationId, { ecosystemId, ...dto });
  }
  async cancel(organizationId: string, id: string): Promise<DeliveryOrderRecord> {
    const d = await this.repo.findById(organizationId, id);
    if (!d) throw new NotFoundException(`DeliveryOrder ${id} not found`);
    try { assertCanCancelDelivery(d.status); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.updateStatus(organizationId, id, 'CANCELLED', { cancelledAt: new Date() });
  }
  async get(organizationId: string, id: string): Promise<DeliveryOrderRecord> {
    const d = await this.repo.findById(organizationId, id);
    if (!d) throw new NotFoundException(`DeliveryOrder ${id} not found`);
    return d;
  }
  estimateCost(distanceKm: number, vehicleType: string): number { return estimateDeliveryCost(distanceKm, vehicleType); }
}
ENDOFFILE

cat > "$SVC/src/delivery/delivery.module.ts" << 'ENDOFFILE'
import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service.js';
import { PrismaDeliveryRepository } from './repository/prisma-delivery-order.repository.js';
import { DELIVERY_REPOSITORY } from './repository/delivery-order.repository.interface.js';
@Module({
  providers: [DeliveryService, { provide: DELIVERY_REPOSITORY, useClass: PrismaDeliveryRepository }],
  exports: [DeliveryService],
})
export class DeliveryModule {}
ENDOFFILE
ok "src/delivery/"

# =============================================================================
# WAREHOUSE — domain + repository + service + module
# =============================================================================
step "src/warehouse/"
cat > "$SVC/src/warehouse/domain/location.errors.ts" << 'ENDOFFILE'
export abstract class DomainError extends Error { constructor(message: string) { super(message); this.name = this.constructor.name; } }
export class LocationInactiveError extends DomainError { constructor(id: string) { super(`Ubicación ${id} inactiva`); } }
export class InsufficientStockError extends DomainError { constructor(v: string, req: number, avail: number) { super(`Stock insuficiente para ${v}: solicitado ${req}, disponible ${avail}`); } }
export class DuplicateLocationCodeError extends DomainError { constructor(code: string) { super(`Código de ubicación "${code}" ya existe`); } }
ENDOFFILE

cat > "$SVC/src/warehouse/domain/location.entity.ts" << 'ENDOFFILE'
import { LocationInactiveError, InsufficientStockError } from './location.errors.js';
export function assertLocationActive(isActive: boolean, id: string): void { if (!isActive) throw new LocationInactiveError(id); }
export function assertSufficientStock(available: number, requested: number, variantId: string): void { if (available < requested) throw new InsufficientStockError(variantId, requested, available); }
ENDOFFILE

cat > "$SVC/src/warehouse/repository/location.repository.interface.ts" << 'ENDOFFILE'
export const WAREHOUSE_REPOSITORY = 'WAREHOUSE_REPOSITORY';
export interface LocationRecord { id: string; ecosystemId: string; organizationId: string; name: string; code: string; depot: string; aisle: string | null; shelf: string | null; capacityUnits: number; isActive: boolean; createdAt: Date; updatedAt: Date; }
export interface StockRecord { id: string; ecosystemId: string; organizationId: string; locationId: string; variantId: string; quantity: number; reserved: number; createdAt: Date; updatedAt: Date; }
export interface WarehouseRepository {
  findLocationById(organizationId: string, id: string): Promise<LocationRecord | null>;
  createLocation(organizationId: string, data: { ecosystemId: string; name: string; code: string; depot: string; aisle?: string; shelf?: string; capacityUnits: number }): Promise<LocationRecord>;
  deactivateLocation(organizationId: string, id: string): Promise<LocationRecord>;
  getStock(organizationId: string, locationId: string, variantId: string): Promise<StockRecord | null>;
  upsertStock(organizationId: string, locationId: string, variantId: string, ecosystemId: string, quantity: number): Promise<StockRecord>;
  moveStock(organizationId: string, fromId: string, toId: string, variantId: string, ecosystemId: string, quantity: number): Promise<void>;
}
ENDOFFILE

cat > "$SVC/src/warehouse/repository/prisma-location.repository.ts" << 'ENDOFFILE'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { WarehouseRepository, LocationRecord, StockRecord } from './location.repository.interface.js';
@Injectable()
export class PrismaWarehouseRepository implements WarehouseRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findLocationById(organizationId: string, id: string) { return this.prisma.warehouseLocation.findFirst({ where: { id, organizationId } }); }
  async createLocation(organizationId: string, data: { ecosystemId: string; name: string; code: string; depot: string; aisle?: string; shelf?: string; capacityUnits: number }): Promise<LocationRecord> { return this.prisma.warehouseLocation.create({ data: { organizationId, ...data } }); }
  async deactivateLocation(organizationId: string, id: string): Promise<LocationRecord> { return this.prisma.warehouseLocation.update({ where: { id }, data: { isActive: false } }); }
  async getStock(organizationId: string, locationId: string, variantId: string): Promise<StockRecord | null> { return this.prisma.warehouseStock.findFirst({ where: { organizationId, locationId, variantId } }); }
  async upsertStock(organizationId: string, locationId: string, variantId: string, ecosystemId: string, quantity: number): Promise<StockRecord> {
    return this.prisma.warehouseStock.upsert({
      where: { locationId_variantId: { locationId, variantId } },
      create: { organizationId, ecosystemId, locationId, variantId, quantity },
      update: { quantity },
    });
  }
  async moveStock(organizationId: string, fromId: string, toId: string, variantId: string, ecosystemId: string, quantity: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.warehouseStock.update({ where: { locationId_variantId: { locationId: fromId, variantId } }, data: { quantity: { decrement: quantity } } }),
      this.prisma.warehouseStock.upsert({ where: { locationId_variantId: { locationId: toId, variantId } }, create: { organizationId, ecosystemId, locationId: toId, variantId, quantity }, update: { quantity: { increment: quantity } } }),
    ]);
  }
}
ENDOFFILE

cat > "$SVC/src/warehouse/warehouse.service.ts" << 'ENDOFFILE'
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { assertLocationActive, assertSufficientStock } from './domain/location.entity.js';
import { DomainError } from './domain/location.errors.js';
import { WAREHOUSE_REPOSITORY, type WarehouseRepository, type LocationRecord, type StockRecord } from './repository/location.repository.interface.js';
@Injectable()
export class WarehouseService {
  constructor(@Inject(WAREHOUSE_REPOSITORY) private readonly repo: WarehouseRepository) {}
  async createLocation(organizationId: string, ecosystemId: string, dto: { name: string; code: string; depot: string; aisle?: string; shelf?: string; capacityUnits: number }): Promise<LocationRecord> { return this.repo.createLocation(organizationId, { ecosystemId, ...dto }); }
  async deactivateLocation(organizationId: string, id: string): Promise<LocationRecord> {
    const loc = await this.repo.findLocationById(organizationId, id);
    if (!loc) throw new NotFoundException(`Location ${id} not found`);
    return this.repo.deactivateLocation(organizationId, id);
  }
  async setStock(organizationId: string, ecosystemId: string, locationId: string, variantId: string, quantity: number): Promise<StockRecord> {
    const loc = await this.repo.findLocationById(organizationId, locationId);
    if (!loc) throw new NotFoundException(`Location ${locationId} not found`);
    try { assertLocationActive(loc.isActive, locationId); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.upsertStock(organizationId, locationId, variantId, ecosystemId, quantity);
  }
  async moveStock(organizationId: string, ecosystemId: string, fromId: string, toId: string, variantId: string, quantity: number): Promise<void> {
    const stock = await this.repo.getStock(organizationId, fromId, variantId);
    if (!stock) throw new NotFoundException(`Stock not found`);
    try { assertSufficientStock(stock.quantity, quantity, variantId); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    await this.repo.moveStock(organizationId, fromId, toId, variantId, ecosystemId, quantity);
  }
  async getStock(organizationId: string, locationId: string, variantId: string): Promise<StockRecord | null> { return this.repo.getStock(organizationId, locationId, variantId); }
}
ENDOFFILE

cat > "$SVC/src/warehouse/warehouse.module.ts" << 'ENDOFFILE'
import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service.js';
import { PrismaWarehouseRepository } from './repository/prisma-location.repository.js';
import { WAREHOUSE_REPOSITORY } from './repository/location.repository.interface.js';
@Module({
  providers: [WarehouseService, { provide: WAREHOUSE_REPOSITORY, useClass: PrismaWarehouseRepository }],
  exports: [WarehouseService],
})
export class WarehouseModule {}
ENDOFFILE
ok "src/warehouse/"

# =============================================================================
# src/grpc/ — controller gRPC del servicio logistics
# =============================================================================
step "src/grpc/"
cat > "$SVC/src/grpc/grpc.module.ts" << 'ENDOFFILE'
import { Module }          from '@nestjs/common';
import { ShippingModule }  from '../shipping/shipping.module.js';
import { DeliveryModule }  from '../delivery/delivery.module.js';
import { WarehouseModule } from '../warehouse/warehouse.module.js';
import { LogisticsGrpcController } from './logistics-grpc.controller.js';

@Module({ imports: [ShippingModule, DeliveryModule, WarehouseModule], controllers: [LogisticsGrpcController] })
export class GrpcModule {}
ENDOFFILE

cat > "$SVC/src/grpc/logistics-grpc.controller.ts" << 'ENDOFFILE'
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
ENDOFFILE
ok "src/grpc/"

# =============================================================================
# src/app.module.ts
# =============================================================================
step "src/app.module.ts"
cat > "$SVC/src/app.module.ts" << 'ENDOFFILE'
import { Module }          from '@nestjs/common';
import { ConfigModule }    from '@nestjs/config';
import { BullModule }      from '@nestjs/bullmq';
import { ScheduleModule }  from '@nestjs/schedule';
import { PrismaModule }    from './prisma/prisma.module.js';
import { HealthModule }    from './health/health.module.js';
import { MetricsModule }   from './metrics/metrics.module.js';
import { ShippingModule }  from './shipping/shipping.module.js';
import { DeliveryModule }  from './delivery/delivery.module.js';
import { WarehouseModule } from './warehouse/warehouse.module.js';
import { GrpcModule }      from './grpc/grpc.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host:     process.env['REDIS_HOST']     ?? 'localhost',
          port:     parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
          password: process.env['REDIS_PASSWORD'],
        },
      }),
    }),
    PrismaModule,
    MetricsModule,
    HealthModule,
    ShippingModule,
    DeliveryModule,
    WarehouseModule,
    GrpcModule,
  ],
})
export class AppModule {}
ENDOFFILE
ok "src/app.module.ts"

# =============================================================================
# src/main.ts — mismo patrón que notificaciones-backend + analytics-backend
# =============================================================================
step "src/main.ts"
cat > "$SVC/src/main.ts" << 'ENDOFFILE'
import 'reflect-metadata';
import { NestFactory }       from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger }         from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join }              from 'path';
import { AppModule }         from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import helmet                from 'helmet';

// Validación de env vars al arranque
const REQUIRED_ENV = [
  'DATABASE_URL', 'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`[logistics-backend] Missing required env var: ${key}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app    = await NestFactory.create(AppModule);

  // gRPC microservicio interno
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:   'logistics',
      protoPath:  join(process.cwd(), 'proto', 'logistics.proto'),
      url:        `0.0.0.0:${process.env['GRPC_PORT'] ?? 5006}`,
    },
  });

  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin:      (process.env['ALLOWED_ORIGINS'] ?? '').split(',').map(s => s.trim()),
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const config = new DocumentBuilder()
    .setTitle('Logistics API')
    .setDescription('Microservicio de logística — Shipping · Delivery · Warehouse')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-organization-id' }, 'x-organization-id')
    .build();
  SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();
  await app.listen(process.env['PORT'] ?? 3005);
  logger.log(`logistics-backend HTTP :${process.env['PORT'] ?? 3005} | gRPC :${process.env['GRPC_PORT'] ?? 5006}`);
}

void bootstrap();
ENDOFFILE
ok "src/main.ts"

# =============================================================================
# Dockerfile — copia exacta del patrón notificaciones-backend / analytics-backend
# =============================================================================
step "Dockerfile"
cat > "$SVC/Dockerfile" << 'ENDOFFILE'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo ecosistema-ms/

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY packages/auth-server/package.json  ./packages/auth-server/
COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY packages/proto/package.json        ./packages/proto/
COPY logistics-backend/package.json     ./logistics-backend/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY package.json pnpm-workspace.yaml ./
COPY logistics-backend/  ./logistics-backend/
COPY packages/           ./packages/
WORKDIR /app/logistics-backend
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3005
ENV GRPC_PORT=5006
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules                   ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/proto        ./proto
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/package.json ./package.json
USER nestjs
EXPOSE 3005
EXPOSE 5006
CMD ["dumb-init", "node", "dist/main"]
ENDOFFILE
ok "Dockerfile"

# =============================================================================
# packages/proto — agregar logistics.proto al índice
# =============================================================================
step "packages/proto/src/index.ts: agregar logistics"

PROTO_INDEX="packages/proto/src/index.ts"
[[ -f "$PROTO_INDEX" ]] || die "No encontrado: $PROTO_INDEX"

if grep -q "LOGISTICS" "$PROTO_INDEX"; then
  warn "logistics ya está en packages/proto/src/index.ts — skip"
else
  cat >> "$PROTO_INDEX" << 'ENDOFFILE'
export const LOGISTICS_PROTO_PATH = join(PROTO_DIR, 'logistics.proto');
export const LOGISTICS_PACKAGE    = 'logistics';
ENDOFFILE
  ok "packages/proto/src/index.ts: LOGISTICS agregado"
fi

# Copiar el proto al directorio compartido de packages/proto
cp "$SVC/proto/logistics.proto" "packages/proto/proto/logistics.proto"
ok "packages/proto/proto/logistics.proto copiado"

# =============================================================================
# packages/grpc-client — crear módulo cliente de logistics
# =============================================================================
step "packages/grpc-client: crear logistics-grpc.module.ts"

mkdir -p "packages/grpc-client/src/logistics"

cat > "packages/grpc-client/src/logistics/logistics-grpc.module.ts" << 'ENDOFFILE'
// packages/grpc-client/src/logistics/logistics-grpc.module.ts
import { Module }                   from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LOGISTICS_PROTO_PATH, LOGISTICS_PACKAGE } from '@ecosistema-ms/proto';

export const LOGISTICS_GRPC_CLIENT = 'LOGISTICS_GRPC_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([{
      name: LOGISTICS_GRPC_CLIENT,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package:   LOGISTICS_PACKAGE,
          protoPath: LOGISTICS_PROTO_PATH,
          url:       process.env['LOGISTICS_GRPC_URL'] ?? 'localhost:5006',
          loader:    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
          channelOptions: {
            'grpc.keepalive_time_ms':              30_000,
            'grpc.keepalive_timeout_ms':            5_000,
            'grpc.keepalive_permit_without_calls':      1,
            'grpc.http2.max_pings_without_data':        0,
            'grpc.max_receive_message_length':  4 * 1024 * 1024,
          },
        },
      }),
    }]),
  ],
  exports: [ClientsModule],
})
export class LogisticsGrpcModule {}
ENDOFFILE

# Agregar export al index de grpc-client
GRPC_INDEX="packages/grpc-client/src/index.ts"
if grep -q "LogisticsGrpcModule" "$GRPC_INDEX"; then
  warn "LogisticsGrpcModule ya está en grpc-client/src/index.ts — skip"
else
  echo 'export { LogisticsGrpcModule } from "./logistics/logistics-grpc.module.js";' >> "$GRPC_INDEX"
  ok "LogisticsGrpcModule agregado a grpc-client/src/index.ts"
fi

# =============================================================================
# pnpm-workspace.yaml — agregar logistics-backend
# =============================================================================
step "pnpm-workspace.yaml: agregar logistics-backend"

if grep -q "logistics-backend" "pnpm-workspace.yaml"; then
  warn "logistics-backend ya está en pnpm-workspace.yaml — skip"
else
  sed -i 's/  - "notificaciones-backend"/  - "notificaciones-backend"\n  - "logistics-backend"/' pnpm-workspace.yaml
  ok "logistics-backend agregado a pnpm-workspace.yaml"
fi

# =============================================================================
# package.json raíz — agregar logistics-backend al build y dev
# =============================================================================
step "package.json raíz: agregar logistics-backend"

if grep -q "logistics-backend" "package.json"; then
  warn "logistics-backend ya está en package.json raíz — skip"
else
  sed -i 's/--filter workers-backend\\\" build/--filter workers-backend --filter logistics-backend\\\" build/' package.json
  sed -i 's/--filter workers-backend start:dev/--filter workers-backend --filter logistics-backend start:dev/' package.json
  ok "package.json raíz actualizado"
fi

# =============================================================================
# VERIFICACIÓN FINAL
# =============================================================================
step "Verificación final"
echo ""

FILES=(
  "$SVC/railway.json"
  "$SVC/package.json"
  "$SVC/tsconfig.json"
  "$SVC/Dockerfile"
  "$SVC/.env.example"
  "$SVC/proto/logistics.proto"
  "$SVC/prisma/schema.prisma"
  "$SVC/src/main.ts"
  "$SVC/src/app.module.ts"
  "$SVC/src/prisma/prisma.service.ts"
  "$SVC/src/prisma/prisma.module.ts"
  "$SVC/src/health/health.controller.ts"
  "$SVC/src/health/health.module.ts"
  "$SVC/src/metrics/metrics.service.ts"
  "$SVC/src/metrics/metrics.module.ts"
  "$SVC/src/metrics/metrics.controller.ts"
  "$SVC/src/common/filters/http-exception.filter.ts"
  "$SVC/src/shipping/domain/shipment.entity.ts"
  "$SVC/src/shipping/domain/shipment.errors.ts"
  "$SVC/src/shipping/repository/shipment.repository.interface.ts"
  "$SVC/src/shipping/repository/prisma-shipment.repository.ts"
  "$SVC/src/shipping/shipping.service.ts"
  "$SVC/src/shipping/shipping.module.ts"
  "$SVC/src/delivery/domain/delivery-order.entity.ts"
  "$SVC/src/delivery/domain/delivery-order.errors.ts"
  "$SVC/src/delivery/repository/delivery-order.repository.interface.ts"
  "$SVC/src/delivery/repository/prisma-delivery-order.repository.ts"
  "$SVC/src/delivery/delivery.service.ts"
  "$SVC/src/delivery/delivery.module.ts"
  "$SVC/src/warehouse/domain/location.entity.ts"
  "$SVC/src/warehouse/domain/location.errors.ts"
  "$SVC/src/warehouse/repository/location.repository.interface.ts"
  "$SVC/src/warehouse/repository/prisma-location.repository.ts"
  "$SVC/src/warehouse/warehouse.service.ts"
  "$SVC/src/warehouse/warehouse.module.ts"
  "$SVC/src/grpc/logistics-grpc.controller.ts"
  "$SVC/src/grpc/grpc.module.ts"
  "packages/proto/proto/logistics.proto"
  "packages/grpc-client/src/logistics/logistics-grpc.module.ts"
)

ALL_OK=1
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then ok "$f"
  else warn "FALTA: $f"; ALL_OK=0; fi
done

echo ""
if [[ $ALL_OK -eq 1 ]]; then
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅  logistics-backend creado — ${#FILES[@]} archivos${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
else
  echo -e "${RED}  ⚠ Algunos archivos no se crearon — revisar arriba${NC}"
fi

echo ""
echo "  Próximos pasos:"
echo "    1. pnpm install"
echo "    2. cd logistics-backend && pnpm prisma migrate dev --name init"
echo "    3. pnpm run start:dev"
echo "    4. Railway: nuevo servicio → Root=/ → Dockerfile=logistics-backend/Dockerfile"
echo "    5. Env vars Railway (ver .env.example)"
echo "    6. Agregar LOGISTICS_GRPC_URL=logistics-backend.railway.internal:5006"
echo "       en los servicios que lo consuman (chatia-backend, workers-backend)"
echo ""