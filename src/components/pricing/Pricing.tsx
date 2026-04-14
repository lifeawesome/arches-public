"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRICING_TIERS, CAPABILITY_CATEGORIES } from "@/lib/pricing-data";

type BillingInterval = "monthly" | "annual";

interface Props {
  user?: any;
}

export default function Pricing({ user }: Props) {
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleCTA = (tierId: string, ctaLink?: string, lookupKey?: string) => {
    setIsLoading(tierId);
    
    // All tiers now require authentication for paid checkout
    if (!user) {
      router.push("/signup");
      setIsLoading(null);
      return;
    }

    // TODO: Handle Stripe checkout with lookupKey
    // For now, redirect to signup for all tiers
    router.push(ctaLink || "/signup");
    setIsLoading(null);
  };

  const getDisplayPrice = (tier: (typeof PRICING_TIERS)[0]) => {
    const price = billingInterval === "annual" ? tier.annual : tier.monthly;
    if (price === "Free") return "Free";
    if (price === "Custom") return "Custom";
    return `$${price}`;
  };

  const getPriceInterval = (tier: (typeof PRICING_TIERS)[0]) => {
    if (tier.monthly === "Free" || tier.monthly === "Custom") return "";
    return billingInterval === "annual" ? "/year" : "/month";
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/30 via-background to-muted/30 py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="mb-6 text-4xl font-bold md:text-5xl lg:text-6xl">
            Choose Your Growth Path
          </h1>
          <p className="mx-auto mb-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
            Arches Network meets you where you are—and grows with you as you build.
          </p>
          <p className="text-base font-semibold text-muted-foreground">
            Affordable daily growth. Start at $9/month.
          </p>

          {/* Billing Toggle */}
          <div className="mt-10 flex justify-center">
            <div className="relative inline-flex rounded-xl border-2 border-border bg-background p-1.5 shadow-sm">
              <button
                onClick={() => setBillingInterval("monthly")}
                type="button"
                className={`${
                  billingInterval === "monthly"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                } relative rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("annual")}
                type="button"
                className={`${
                  billingInterval === "annual"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                } relative rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
              >
                Annual
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    billingInterval === "annual"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  2 months free
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="mb-20 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PRICING_TIERS.map((tier) => {
            const lookupKey =
              billingInterval === "annual"
                ? tier.lookupKey?.annual
                : tier.lookupKey?.monthly;
            return (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-background shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                tier.isPopular
                  ? "border-primary lg:scale-105"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {tier.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4">
                  <h3 className="mb-2 text-2xl font-bold">{tier.name}</h3>
                  <p className="mb-3 text-sm font-semibold text-primary">
                    {tier.tagline}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {tier.whoItsFor}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Purpose
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {tier.purpose}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">{getDisplayPrice(tier)}</span>
                    <span className="ml-2 text-base text-muted-foreground">
                      {getPriceInterval(tier)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isLoading === tier.id}
                  onClick={() => handleCTA(tier.id, tier.ctaLink, lookupKey)}
                  className={`mb-6 w-full rounded-lg py-5 text-sm font-semibold transition-all ${
                    tier.isPopular
                      ? "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                      : tier.id === "explorer"
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border-2 border-border bg-background text-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {isLoading === tier.id ? "Loading..." : tier.cta}
                </button>

                <div className="flex-grow space-y-2.5">
                  {Object.entries(tier.capabilities).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>
                      <span className="text-xs text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Capability Comparison */}
        <div className="mb-20">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              What You Get at Each Level
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Clear capabilities, not confusing feature lists.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-border bg-background shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-6 py-4 text-left text-sm font-bold">
                      Capability
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.id}
                        className="px-6 py-4 text-center text-sm font-bold"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CAPABILITY_CATEGORIES.map((category, idx) => (
                    <tr key={category.key} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {category.label}
                      </td>
                      {PRICING_TIERS.map((tier) => (
                        <td
                          key={tier.id}
                          className="px-6 py-4 text-center text-xs text-muted-foreground"
                        >
                          {
                            tier.capabilities[
                              category.key as keyof typeof tier.capabilities
                            ]
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-12 text-center">
          <h3 className="mb-4 text-2xl font-bold md:text-3xl">
            Not sure where to start?
          </h3>
          <p className="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
            Begin with Explorer at $9/month—affordable daily growth for anyone building a business.
          </p>
          <button
            onClick={() => router.push("/signup")}
            className="rounded-lg bg-primary px-8 py-6 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
          >
            Get Started
          </button>
        </div>
      </div>
    </section>
  );
}

