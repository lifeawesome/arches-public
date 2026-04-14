/**
 * Expert Offers Type Definitions
 *
 * Types for expert service offerings that can be created, managed,
 * and matched with work requests.
 */

export type PricingType = "fixed" | "hourly" | "both";

export interface ExpertOffer {
  id: string;
  expert_id: string;
  title: string;
  description: string;
  image_url?: string;
  deliverables: string[];
  pricing_type: PricingType;
  fixed_price?: number;
  hourly_rate?: number;
  estimated_hours?: number;
  estimated_delivery_days: number;
  required_skills: string[];
  prerequisites: string[];
  expertise_category?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateOfferInput {
  title: string;
  description: string;
  image_url?: string;
  deliverables: string[];
  pricing_type: PricingType;
  fixed_price?: number;
  hourly_rate?: number;
  estimated_hours?: number;
  estimated_delivery_days: number;
  required_skills?: string[];
  prerequisites?: string[];
  expertise_category?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateOfferInput extends Partial<CreateOfferInput> {
  id: string;
}

export interface OfferMatchResult {
  offerId: string;
  offerTitle: string;
  matchScore: number; // 0-100
  matchReasons: string[];
  pricingInfo: {
    type: PricingType;
    fixedPrice?: number;
    hourlyRate?: number;
    estimatedHours?: number;
  };
  estimatedDeliveryDays: number;
}
