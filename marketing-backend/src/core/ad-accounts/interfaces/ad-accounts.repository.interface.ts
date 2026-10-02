// marketing-backend/src/core/ad-accounts/interfaces/ad-accounts.repository.interface.ts
export const AD_ACCOUNTS_REPOSITORY = Symbol("AD_ACCOUNTS_REPOSITORY");

export interface IAdAccountsRepository {
  findByOrganization(organizationId: string): Promise<AdAccountRecord[]>;
  findById(id: string, organizationId: string): Promise<AdAccountRecord | null>;
  create(data: CreateAdAccountInput): Promise<AdAccountRecord>;
  revoke(id: string, organizationId: string): Promise<void>;
}

export interface AdAccountRecord {
  id:             string;
  organizationId: string;
  platform:       string;
  externalId:     string;
  accessToken:    string;
  active:         boolean;
  createdAt:      Date;
}

export interface CreateAdAccountInput {
  organizationId: string;
  platform:       string;
  externalId:     string;
  accessToken:    string;
}
