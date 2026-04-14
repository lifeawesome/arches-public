export interface TierBannerConfig {
  name: string;
  badge: string;
  tagline: string;
  gradient: string;
  benefits: string[];
  cta: {
    text: string;
    link: string;
  };
}

export const TIER_BANNER_CONFIG: Record<string, TierBannerConfig> = {
  explorer: {
    name: "Explorer",
    badge: "🌱",
    tagline: "Start Your Journey",
    gradient: "from-green-400 to-green-600",
    benefits: [
      "Access to community directory",
      "Basic pathway content",
      "Community support",
    ],
    cta: {
      text: "Explore Features",
      link: "/pricing",
    },
  },
  builder: {
    name: "Builder",
    badge: "🏗️",
    tagline: "Build Your Network",
    gradient: "from-blue-400 to-blue-600",
    benefits: [
      "All Explorer features",
      "Advanced networking tools",
      "Priority support",
    ],
    cta: {
      text: "Upgrade Now",
      link: "/pricing",
    },
  },
  pro: {
    name: "Pro",
    badge: "⭐",
    tagline: "Professional Excellence",
    gradient: "from-purple-400 to-purple-600",
    benefits: [
      "All Builder features",
      "Exclusive content",
      "1-on-1 mentorship",
    ],
    cta: {
      text: "Go Pro",
      link: "/pricing",
    },
  },
  partner: {
    name: "Partner",
    badge: "🤝",
    tagline: "Elite Partnership",
    gradient: "from-orange-400 to-orange-600",
    benefits: [
      "All Pro features",
      "Custom solutions",
      "Dedicated account manager",
    ],
    cta: {
      text: "Learn More",
      link: "/pricing",
    },
  },
};

