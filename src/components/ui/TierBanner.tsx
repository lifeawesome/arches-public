"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TIER_BANNER_CONFIG } from "@/lib/tier-banner-data";
import {
  ExplorerIllustration,
  BuilderIllustration,
  ProIllustration,
  PartnerIllustration,
} from "@/components/ui/TierIllustrations";
import { ArrowRight, TrendingUp } from "lucide-react";

interface TierBannerProps {
  tier?: string;
  stats?: {
    connections?: number;
    events?: number;
    savedItems?: number;
  };
}

export function TierBanner({ tier = "explorer", stats }: TierBannerProps) {
  const tierConfig =
    TIER_BANNER_CONFIG[tier.toLowerCase()] || TIER_BANNER_CONFIG.explorer;

  const IllustrationComponent =
    {
      explorer: ExplorerIllustration,
      builder: BuilderIllustration,
      pro: ProIllustration,
      partner: PartnerIllustration,
    }[tier.toLowerCase()] || ExplorerIllustration;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${tierConfig.gradient} p-8 md:p-12 shadow-lg mb-8`}
    >
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left Content */}
        <div className="flex-1 space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm">
            <span
              className="text-2xl"
              role="img"
              aria-label={`${tierConfig.name} tier`}
            >
              {tierConfig.badge}
            </span>
            <span className="font-semibold text-gray-900">
              {tierConfig.name} Member
            </span>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-3xl md:text-4xl font-montserratBold text-gray-900 mb-2">
              {tierConfig.tagline}
            </h2>
            <p className="text-lg text-gray-700">
              You&apos;re on the{" "}
              <span className="font-semibold">{tierConfig.name}</span> plan
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            {tierConfig.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-orange-600"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-800 font-medium">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Stats Progress (if provided) */}
          {stats && (stats.connections || stats.events || stats.savedItems) ? (
            <div className="flex flex-wrap gap-6 pt-4">
              {stats.connections !== undefined && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.connections}
                    </div>
                    <div className="text-xs text-gray-600">Connections</div>
                  </div>
                </div>
              )}
              {stats.events !== undefined && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.events}
                    </div>
                    <div className="text-xs text-gray-600">Events</div>
                  </div>
                </div>
              )}
              {stats.savedItems !== undefined && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.savedItems}
                    </div>
                    <div className="text-xs text-gray-600">Saved Items</div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* CTA Button */}
          <div>
            <Link href={tierConfig.cta.link}>
              <Button
                size="lg"
                className="bg-orange-600 hover:bg-orange-700 text-white shadow-md group"
              >
                {tierConfig.cta.text}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Illustration */}
        <div className="flex-shrink-0 hidden display:none md:block">
          <IllustrationComponent className="opacity-0 hover:opacity-100 transition-opacity w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48" />
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -z-0" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -z-0" />
    </div>
  );
}
