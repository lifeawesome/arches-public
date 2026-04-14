"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRICING_TIERS } from "@/lib/pricing-data";
import { useRouter } from "next/navigation";
import { handleStripeCheckout } from "@/lib/utils/stripe/client";
import { Check, Sparkles } from "lucide-react";

interface PlanSelectionProps {
  onSkip?: () => void;
  showSkipOption?: boolean;
}

export function PlanSelection({ onSkip, showSkipOption = true }: PlanSelectionProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const router = useRouter();

  // Filter out Explorer (free) and Partner (application-only) for onboarding
  const paidTiers = PRICING_TIERS.filter(
    (tier) => tier.id !== "explorer" && tier.id !== "partner"
  );

  const handleSelectPlan = async (tierId: string) => {
    const tier = PRICING_TIERS.find((t) => t.id === tierId);
    if (!tier || !tier.lookupKey) return;

    const lookupKey =
      billingInterval === "monthly"
        ? tier.lookupKey.monthly
        : tier.lookupKey.annual;

    if (!lookupKey) return;

    setIsLoading(tierId);

    try {
      // Return to /account after checkout, not to /onboarding
      await handleStripeCheckout(lookupKey, "/account");
      // Stripe will redirect, so we don't need to do anything else
    } catch (error) {
      console.error("Checkout error:", error);
      setIsLoading(null);
      // Show error toast or message
      alert("Unable to start checkout. Please try again.");
    }
  };

  const getDisplayPrice = (tier: typeof PRICING_TIERS[0]) => {
    const price = billingInterval === "annual" ? tier.annual : tier.monthly;
    if (price === "Free") return "Free";
    if (price === "Custom") return "Custom";
    return `$${price}`;
  };

  const getPriceInterval = (tier: typeof PRICING_TIERS[0]) => {
    if (tier.monthly === "Free" || tier.monthly === "Custom") return "";
    return billingInterval === "annual" ? "/year" : "/month";
  };

  return (
    <div className="w-full py-8">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Badge className="bg-gradient-to-r from-orange-500 to-rose-500 text-white border-none px-4 py-1.5 text-sm font-semibold mb-4">
            <Sparkles className="h-3 w-3 mr-1 inline" />
            Choose Your Path
          </Badge>
          <h2 className="text-3xl md:text-4xl font-montserratBold text-gray-900">
            Build with clarity. Grow with confidence.
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select the tier that matches where you are in your journey. You can always
            change or cancel later.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="relative inline-flex bg-white rounded-xl p-1.5 border-2 border-gray-200 shadow-sm">
            <button
              onClick={() => setBillingInterval("monthly")}
              type="button"
              className={`${
                billingInterval === "monthly"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg"
                  : "text-gray-700 hover:text-gray-900"
              } relative px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("annual")}
              type="button"
              className={`${
                billingInterval === "annual"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg"
                  : "text-gray-700 hover:text-gray-900"
              } relative px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200`}
            >
              Annual
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  billingInterval === "annual" ? "bg-white/20 text-white" : "text-gray-700"
                }`}
              >
                2 months free
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {paidTiers.map((tier) => {
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl shadow-xl bg-white border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                  tier.isPopular
                    ? "border-orange-500 md:scale-105"
                    : "border-gray-200 hover:border-orange-300"
                }`}
              >
                {/* Popular badge */}
                {tier.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-orange-500 to-rose-500 text-white border-none px-3 py-1 text-xs font-semibold shadow-lg">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  {/* Tier name and tagline */}
                  <div className="mb-4">
                    <h3 className="text-2xl font-montserratBold text-gray-900 mb-2">
                      {tier.name}
                    </h3>
                    <p className="text-sm font-semibold text-orange-600 mb-3">
                      {tier.tagline}
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {tier.whoItsFor}
                    </p>
                  </div>

                  {/* Purpose */}
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Purpose
                    </p>
                    <p className="text-sm text-gray-700 font-medium">
                      {tier.purpose}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-montserratBold text-gray-900">
                        {getDisplayPrice(tier)}
                      </span>
                      <span className="text-base text-gray-500 ml-2">
                        {getPriceInterval(tier)}
                      </span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Button
                    type="button"
                    disabled={isLoading === tier.id}
                    onClick={() => handleSelectPlan(tier.id)}
                    className={`w-full py-5 text-sm font-semibold transition-all mb-6 ${
                      tier.isPopular
                        ? "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg hover:shadow-xl"
                        : "bg-white border-2 border-gray-300 hover:border-orange-500 text-gray-900 hover:text-orange-600"
                    }`}
                  >
                    {isLoading === tier.id ? "Loading..." : tier.cta}
                  </Button>

                  {/* Key Capabilities */}
                  <div className="space-y-2.5 flex-grow">
                    {Object.entries(tier.capabilities).slice(0, 5).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-orange-400 to-rose-400 flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        </div>
                        <span className="text-xs text-gray-700">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skip Option */}
        {showSkipOption && (
          <div className="text-center space-y-2 pt-4">
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-gray-600 hover:text-gray-900"
            >
              Skip for now — Start with Explorer (Free)
            </Button>
            <p className="text-xs text-gray-500">
              You can upgrade anytime from your account settings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}





