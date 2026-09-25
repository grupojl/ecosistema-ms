// notificaciones-backend/src/core/strategies/project-context.interface.ts
// ADR-019 v2 — ProjectStrategy org-aware para notificaciones.

export interface NotifFeatureFlags {
  emailEnabled:     boolean;
  smsEnabled:       boolean;
  whatsappEnabled:  boolean;
  pushEnabled:      boolean;
  /** Respetar horario de atención para no enviar fuera de hora */
  respectBusinessHours: boolean;
}

export interface NotifLimits {
  /** Máximo de notificaciones por usuario por día */
  maxPerUserPerDay:   number;
  /** Ventana de deduplicación en segundos */
  dedupWindowSeconds: number;
}

export interface OrganizationProfile {
  organizationId:  string;
  ecosystemId:     string;
  plan:            'starter' | 'growth' | 'enterprise' | 'custom';
  featureFlags:    NotifFeatureFlags;
  limits:          NotifLimits;
  timezone:        string;
  locale:          string;
  updatedAt:       Date;
}

export interface NotifProjectContext {
  /** Canal preferido según config de la org */
  preferredChannel:  'email' | 'sms' | 'whatsapp' | 'push';
  /** Canales habilitados en orden de prioridad */
  enabledChannels:   string[];
  /** Idioma del template a usar */
  locale:            string;
  orgProfile:        OrganizationProfile;
  businessData:      unknown;
}

export const DEFAULT_ORG_PROFILE: OrganizationProfile = {
  organizationId: 'unknown', ecosystemId: 'unknown', plan: 'starter',
  featureFlags: {
    emailEnabled: true, smsEnabled: false, whatsappEnabled: false,
    pushEnabled: false, respectBusinessHours: false,
  },
  limits: { maxPerUserPerDay: 10, dedupWindowSeconds: 3600 },
  timezone: 'America/Buenos_Aires', locale: 'es', updatedAt: new Date(0),
};
