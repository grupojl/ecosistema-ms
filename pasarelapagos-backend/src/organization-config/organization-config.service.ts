// pasarelapagos-backend/src/organization-config/organization-config.service.ts
// Cache Redis TTL 5min. NUNCA lanza.
import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  PAYMENT_ORG_CONFIG_REPO, toOrgProfile,
  type IPaymentOrgConfigRepository, type UpsertOrgConfigInput,
} from './organization-config.repository.interface.js';
import { DEFAULT_ORG_PROFILE, type OrganizationProfile } from '../core/strategies/project-context.interface.js';

// Redis inyectado via REDIS_CLIENT (ya existe en pasarelapagos-backend)
const REDIS_CLIENT = 'REDIS_CLIENT';
const TTL_5MIN = 300;
const ckey = (eco: string, org: string) => `pagoorgcfg:${eco}:${org}`;

@Injectable()
export class PaymentOrgConfigService {
  private readonly logger = new Logger(PaymentOrgConfigService.name);

  constructor(
    @Inject(PAYMENT_ORG_CONFIG_REPO) private readonly repo: IPaymentOrgConfigRepository,
    @Inject(REDIS_CLIENT)            private readonly redis: { get(k:string): Promise<string|null>; setex(k:string,t:number,v:string): Promise<unknown>; del(k:string): Promise<unknown> },
  ) {}

  async resolve(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    try {
      const raw = await this.redis.get(ckey(ecosystemId, organizationId));
      if (raw) return JSON.parse(raw) as OrganizationProfile;

      const stored = await this.repo.findByOrgId(ecosystemId, organizationId);
      const profile = stored
        ? toOrgProfile(stored)
        : { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };

      await this.redis.setex(ckey(ecosystemId, organizationId), TTL_5MIN, JSON.stringify(profile));
      return profile;
    } catch (err: unknown) {
      this.logger.error(`PaymentOrgConfig error ${ecosystemId}/${organizationId}: ${err instanceof Error ? err.message : String(err)}`);
      return { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };
    }
  }

  async upsert(input: UpsertOrgConfigInput): Promise<OrganizationProfile> {
    const stored = await this.repo.upsert(input);
    const profile = toOrgProfile(stored);
    await this.redis.del(ckey(input.ecosystemId, input.organizationId));
    return profile;
  }
}
