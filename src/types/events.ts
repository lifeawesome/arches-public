export interface EventLocation {
  type: "online" | "in-person" | "hybrid";
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  onlineLink?: string;
  onlineInstructions?: string;
}

export interface EventOrganizer {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  bio?: string;
}

export interface EventSpeaker {
  name: string;
  title?: string;
  company?: string;
  bio?: string;
  photo?: {
    asset: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  linkedin?: string;
  twitter?: string;
  website?: string;
  sessionTitle?: string;
  sessionDescription?: string;
}

export interface EventCapacity {
  maxAttendees?: number;
  currentAttendees?: number;
  waitlistEnabled?: boolean;
}

export interface EventPricing {
  isFree: boolean;
  price?: number;
  currency?: string;
  earlyBirdPrice?: number;
  earlyBirdEndDate?: string;
  memberDiscount?: {
    enabled: boolean;
    discountType?: "percentage" | "fixed";
    discountValue?: number;
  };
}

export interface EventRegistration {
  registrationUrl?: string;
  registrationDeadline?: string;
  requiresApproval?: boolean;
  registrationInstructions?: string;
}

export interface EventAgendaItem {
  time: string;
  title: string;
  description?: string;
  speaker?: string;
  duration?: number;
}

export interface EventResource {
  title: string;
  url: string;
  description?: string;
  type: "slides" | "recording" | "document" | "link" | "other";
}

export interface EventSEO {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  ogImage?: {
    asset: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  canonicalUrl?: string;
  noIndex?: boolean;
}

export interface Event {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  description: string;
  content?: any[];
  eventType: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: EventLocation;
  organizer: EventOrganizer;
  speakers?: EventSpeaker[];
  capacity?: EventCapacity;
  pricing: EventPricing;
  registration?: EventRegistration;
  tags?: string[];
  category: string;
  difficulty: string;
  prerequisites?: string;
  agenda?: EventAgendaItem[];
  resources?: EventResource[];
  eventImage?: {
    asset: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  featured: boolean;
  status: string;
  publishedAt: string;
  seo?: EventSEO;
}

export interface EventListingItem {
  _id: string;
  title: string;
  slug: {
    current: string;
  };
  description: string;
  eventType: string;
  startDate: string;
  endDate: string;
  timezone: string;
  location: EventLocation;
  organizer: EventOrganizer;
  speakers?: EventSpeaker[];
  capacity?: EventCapacity;
  pricing: EventPricing;
  registration?: EventRegistration;
  tags?: string[];
  category: string;
  difficulty: string;
  eventImage?: {
    asset: {
      _id: string;
      url: string;
    };
    alt?: string;
  };
  featured: boolean;
  status: string;
  publishedAt: string;
}

export type EventType =
  | "workshop"
  | "conference"
  | "meetup"
  | "webinar"
  | "networking"
  | "training"
  | "panel-discussion"
  | "demo-day"
  | "hackathon"
  | "other";

export type EventCategory =
  | "technology"
  | "business"
  | "design"
  | "marketing"
  | "startup"
  | "networking"
  | "education"
  | "career"
  | "community"
  | "other";

export type EventDifficulty = "beginner" | "intermediate" | "advanced" | "all";

export type EventStatus =
  | "draft"
  | "published"
  | "cancelled"
  | "postponed"
  | "completed";
