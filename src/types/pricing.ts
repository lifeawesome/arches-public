// Pricing types for Arches Network

export interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  whoItsFor: string;
  purpose: string;
  monthly: number | 'Free' | 'Custom';
  annual: number | 'Free' | 'Custom';
  lookupKey: {
    monthly?: string;
    annual?: string;
  };
  cta: string;
  ctaLink?: string;
  isPopular?: boolean;
  isApplication?: boolean;
  capabilities: PricingCapabilities;
}

export interface PricingCapabilities {
  platformAccess: string;
  circles: string;
  experts: string;
  workRequests: string;
  ai: string;
  support: string;
}

export type CapabilityLevel = 'full' | 'limited' | 'locked';

export type BillingInterval = 'monthly' | 'annual';










