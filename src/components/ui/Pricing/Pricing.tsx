"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { PRICING_TIERS, CAPABILITY_CATEGORIES } from "@/lib/pricing-data";
import { BillingInterval } from "@/types/pricing";

interface Props {
  user: User | null | undefined;
}

export default function Pricing({ user }: Readonly<Props>) {
  const router = useRouter();
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleCTA = async (
    tierId: string,
    ctaLink?: string,
    lookupKey?: string
  ) => {
    setIsLoading(tierId);

    // Explorer tier - redirect to signup
    if (tierId === "explorer") {
      router.push(ctaLink || "/signup");
      setIsLoading(null);
      return;
    }

    // Partner tier - redirect to application
    if (tierId === "partner") {
      router.push(ctaLink || "/contact?subject=partner");
      setIsLoading(null);
      return;
    }

    // Paid tiers - handle Stripe checkout
    if (!user) {
      router.push("/login");
      setIsLoading(null);
      return;
    }

    // Call Stripe checkout with lookup_key
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookupKey: lookupKey,
          returnUrl: "/account",
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
        setIsLoading(null);
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      setIsLoading(null);
    }
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
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl px-4 py-16 mx-auto sm:py-24 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <div className="text-center mb-16">
          <Badge className="bg-gradient-to-r from-orange-500 to-rose-500 text-white border-none px-4 py-1.5 text-sm font-semibold mb-6">
            <Sparkles className="h-3 w-3 mr-1 inline" />
            Identity-First Pricing
          </Badge>
          <h1 className="text-4xl md:text-6xl font-montserratBold text-gray-900 mb-6 leading-tight">
            Build with clarity.
            <br />
            Grow with confidence.
            <br />
            Scale with the right support.
          </h1>
          <p className="max-w-3xl mx-auto text-lg md:text-xl text-gray-600 mb-4">
            Arches Network meets you where you are—and grows with you as you
            build.
          </p>
          <p className="text-base text-gray-500 font-semibold">
            Start free. Upgrade when momentum matters.
          </p>

          {/* Billing Toggle */}
          <div className="flex justify-center mt-10">
            <div className="relative inline-flex bg-white rounded-xl p-1.5 border-2 border-gray-200 shadow-sm">
              <button
                onClick={() => setBillingInterval("monthly")}
                type="button"
                className={`${
                  billingInterval === "monthly"
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg"
                    : "text-gray-700 hover:text-gray-900"
                } relative px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2`}
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
                } relative px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2`}
              >
                Annual
                <span
                  className={`"ml-2 text-xs px-2 py-0.5 rounded-full" 
                    ${billingInterval === "annual" ? "bg-white/20  text-white" : "text-gray-700"}`}
                >
                  2 months free
                </span>
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-500 italic">
            Commit to momentum. Save when you go annual.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-20">
          {PRICING_TIERS.map((tier) => {
            const lookupKey =
              billingInterval === "annual"
                ? tier.lookupKey?.annual
                : tier.lookupKey?.monthly;

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl shadow-xl bg-white border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                  tier.isPopular
                    ? "border-orange-500 lg:scale-105"
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
                    onClick={() => handleCTA(tier.id, tier.ctaLink, lookupKey)}
                    className={`w-full py-5 text-sm font-semibold transition-all mb-6 ${
                      tier.isPopular
                        ? "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg hover:shadow-xl"
                        : tier.id === "explorer"
                          ? "bg-gray-900 hover:bg-gray-800 text-white"
                          : "bg-white border-2 border-gray-300 hover:border-orange-500 text-gray-900 hover:text-orange-600"
                    }`}
                  >
                    {isLoading === tier.id ? "Loading..." : tier.cta}
                    {!tier.isApplication && (
                      <ArrowRight className="ml-2 h-4 w-4 inline" />
                    )}
                  </Button>

                  {/* Capabilities */}
                  <div className="space-y-2.5 flex-grow">
                    {Object.entries(tier.capabilities).map(([key, value]) => (
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

        {/* Capability Comparison Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-montserratBold text-gray-900 mb-4">
              What You Get at Each Level
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Clear capabilities, not confusing feature lists.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-orange-50 to-rose-50">
                    <th className="px-6 py-4 text-left text-sm font-montserratBold text-gray-900">
                      Capability
                    </th>
                    {PRICING_TIERS.map((tier) => (
                      <th
                        key={tier.id}
                        className="px-6 py-4 text-center text-sm font-montserratBold text-gray-900"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {CAPABILITY_CATEGORIES.map((category, idx) => (
                    <tr
                      key={category.key}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {category.label}
                      </td>
                      {PRICING_TIERS.map((tier) => (
                        <td
                          key={tier.id}
                          className="px-6 py-4 text-center text-xs text-gray-700"
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

        {/* Upgrade Philosophy Section */}
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-montserratBold text-gray-900 mb-4">
            How Upgrading Works
          </h2>
          <p className="text-lg text-gray-600 mb-4">
            Arches is designed to grow with you.
          </p>
          <p className="text-base text-gray-600">
            Start where you are. When you want more momentum, faster decisions,
            or expert feedback, upgrading unlocks the next level of support—no
            pressure, no contracts.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mb-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-montserratBold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h3 className="text-lg font-montserratBold text-gray-900 mb-2">
                Can I switch plans later?
              </h3>
              <p className="text-gray-600">
                Yes—upgrade or downgrade anytime. Upgrades take effect
                immediately, downgrades apply at your next billing cycle.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h3 className="text-lg font-montserratBold text-gray-900 mb-2">
                What if I&apos;m not ready?
              </h3>
              <p className="text-gray-600">
                That&apos;s exactly what Explorer is for. Take your time, explore the
                platform, and upgrade when you&apos;re ready for more.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h3 className="text-lg font-montserratBold text-gray-900 mb-2">
                Is this a course or a community?
              </h3>
              <p className="text-gray-600">
                It's a system designed to help you execute—with tools, experts,
                and guidance when you need them. Not content to consume, but
                support to build.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-gradient-to-r from-orange-50 to-rose-50 rounded-2xl p-12 border-2 border-orange-200">
          <h3 className="text-2xl md:text-3xl font-montserratBold text-gray-900 mb-4">
            Not sure where to start?
          </h3>
          <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
            Begin with Explorer—it's free, and it will show you what's next.
          </p>
          <Button
            onClick={() => router.push("/signup")}
            className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Start Free
            <ArrowRight className="ml-2 h-5 w-5 inline" />
          </Button>
        </div>
      </div>
    </section>
  );
}
