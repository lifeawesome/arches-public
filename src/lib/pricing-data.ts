export type PricingTier = {
  id: string;
  name: string;
  tagline: string;
  whoItsFor: string;
  purpose: string;
  monthly: number | "Free" | "Custom";
  annual: number | "Free" | "Custom";
  lookupKey?: {
    monthly?: string;
    annual?: string;
  };
  cta: string;
  ctaLink?: string;
  isPopular?: boolean;
  isApplication?: boolean;
  capabilities: {
    platformAccess: string;
    paths: string;
    tasks: string;
    achievements: string;
    directory: string;
    support: string;
  };
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "explorer",
    name: "Explorer",
    tagline: "Foundation access for daily growth.",
    whoItsFor: "You're committed to showing up daily and building expert confidence through consistent action.",
    purpose: "Daily habit & growth foundation",
    monthly: 9,
    annual: 90,
    lookupKey: {
      monthly: "arches_explorer_monthly",
      annual: "arches_explorer_annual",
    },
    cta: "Start Your Daily Practice",
    capabilities: {
      platformAccess: "Daily Action Engine",
      paths: "Core growth pathways",
      tasks: "Daily 15-30 min tasks",
      achievements: "XP, streaks, achievements",
      directory: "Proof-of-completion sharing",
      support: "Dream Team (limited connections)",
    },
  },
  {
    id: "practitioner",
    name: "Practitioner",
    tagline: "Growth, feedback, and engagement.",
    whoItsFor: "You're serious about accelerating growth and want feedback, peer engagement, and more pathways.",
    purpose: "Growth & feedback",
    monthly: 19,
    annual: 180,
    lookupKey: {
      monthly: "arches_practitioner_monthly",
      annual: "arches_practitioner_annual",
    },
    cta: "Level Up Your Growth",
    isPopular: true,
    capabilities: {
      platformAccess: "Everything in Explorer",
      paths: "Additional pathways unlocked",
      tasks: "Feedback prompts & peer engagement",
      achievements: "Progress analytics",
      directory: "Social visibility (wins feed)",
      support: "More Dream Team connections",
    },
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "Visibility and earned credibility.",
    whoItsFor: "You're ready to be seen and want public profile, directory inclusion, and credibility signals.",
    purpose: "Visibility & credibility",
    monthly: 29,
    annual: 270,
    lookupKey: {
      monthly: "arches_professional_monthly",
      annual: "arches_professional_annual",
    },
    cta: "Amplify Your Expertise",
    capabilities: {
      platformAccess: "Everything in Practitioner",
      paths: "All pathways included",
      tasks: "Priority task scheduling",
      achievements: "Credibility badges",
      directory: "Public expert profile & directory",
      support: "Featured wins & leaderboard visibility",
    },
  },
  {
    id: "established",
    name: "Established",
    tagline: "Monetization and advanced support.",
    whoItsFor: "You're ready to monetize your expertise and want frameworks, tools, and priority placement.",
    purpose: "Monetization & advanced growth",
    monthly: 49,
    annual: 450,
    lookupKey: {
      monthly: "arches_established_monthly",
      annual: "arches_established_annual",
    },
    cta: "Monetize Your Expertise",
    capabilities: {
      platformAccess: "Everything in Professional",
      paths: "Monetization pathways",
      tasks: "Offer & pricing frameworks",
      achievements: "Advanced analytics & insights",
      directory: "Lead/contact tools",
      support: "Priority placement & support",
    },
  },
];

export const CAPABILITY_CATEGORIES = [
  { key: "platformAccess", label: "Platform Access" },
  { key: "paths", label: "Pathways & Learning" },
  { key: "tasks", label: "Daily Tasks" },
  { key: "achievements", label: "Progress & Achievements" },
  { key: "directory", label: "Directory & Profile" },
  { key: "support", label: "Support" },
] as const;

