// chatia-backend/src/organization-config/organization-config.service.ts
// Cache-aside Redis TTL 5min + degradación elegante garantizada.
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { CacheService }          from '../common/services/cache.service.js';
import {
  ORGANIZATION_CONFIG_REPO, toOrgProfile,
  type IOrganizationConfigRepository, type UpsertOrgConfigInput,
} from './organization-config.repository.interface.js';
import {
  DEFAULT_ORG_PROFILE, type OrganizationProfile,
} from '../core/strategies/project-context.interface.js';

const TTL_5MIN = 300;
const ckey = (eco: string, org: string) => `orgcfg:${eco}:${org}`;

@Injectable()
export class OrganizationConfigService {
  private readonly logger = new Logger(OrganizationConfigService.name);

  constructor(
    @Inject(ORGANIZATION_CONFIG_REPO)
    private readonly repo:  IOrganizationConfigRepository,
    private readonly cache: CacheService,
  ) {}

  /** Siempre retorna un valor válido. NUNCA lanza. */
  async resolve(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    try {
      const cached = await this.cache.get<OrganizationProfile>(ckey(ecosystemId, organizationId));
      if (cached) return cached;

      const stored = await this.repo.findByOrgId(ecosystemId, organizationId);
      const profile = stored
        ? toOrgProfile(stored)
        : { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };

      await this.cache.set(ckey(ecosystemId, organizationId), profile, TTL_5MIN);
      return profile;
    } catch (err: unknown) {
      this.logger.error(
        `Error resolviendo OrgProfile ${ecosystemId}/${organizationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };
    }
  }

  async upsert(input: UpsertOrgConfigInput): Promise<OrganizationProfile> {
    const stored  = await this.repo.upsert(input);
    const profile = toOrgProfile(stored);
    await this.cache.del(ckey(input.ecosystemId, input.organizationId));
    this.logger.log(`OrgConfig upserted + cache invalidada: ${input.ecosystemId}/${input.organizationId}`);
    return profile;
  }

  async listByEcosystem(ecosystemId: string): Promise<OrganizationProfile[]> {
    const rows = await this.repo.findAllByEcosystem(ecosystemId);
    return rows.map(toOrgProfile);
  }
}
