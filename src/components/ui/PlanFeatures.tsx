"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowUp, ArrowDown } from "lucide-react";
import { handleStripeCheckout } from "@/lib/utils/stripe/client";
import { useState } from "react";
import Link from "next/link";

interface PlanTier {
  id: string;
  name: string;
  price: string;
  features: string[];
  lookupKey?: string;
  order: number;
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: "explorer",
    name: "Explorer",
    price: "Free",
    features: [
      "Browse & discover the network",
      "View public circles",
      "Basic AI guidance",
    ],
    order: 0,
  },
  {
    id: "builder",
    name: "Builder",
    price: "$29/month",
    features: [
      "Join unlimited circles",
      "Message & save experts",
      "AI work breakdown",
    ],
    lookupKey: "arches_builder_monthly",
    order: 1,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99/month",
    features: [
      "Priority search & filters",
      "Create circles & host sessions",
      "Advanced AI coaching",
    ],
    lookupKey: "arches_pro_monthly",
    order: 2,
  },
  {
    id: "partner",
    name: "Partner",
    price: "$399/month",
    features: [
      "API access & integrations",
      "Dedicated expert team",
      "Custom AI training",
    ],
    lookupKey: "arches_partner_monthly",
    order: 3,
  },
];

interface PlanFeaturesProps {
  currentTier: string;
}

export function PlanFeatures({ currentTier }: PlanFeaturesProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const currentPlanOrder = PLAN_TIERS.find((t) => t.id === currentTier)?.order ?? 0;

  const handleUpgrade = async (lookupKey: string, planId: string) => {
    setLoadingPlan(planId);
    try {
      await handleStripeCheckout(lookupKey, "/account/settings/subscription");
    } catch (error) {
      console.error("Error starting checkout:", error);
      alert("Unable to start checkout. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      {PLAN_TIERS.map((tier) => {
        const isCurrentPlan = tier.id === currentTier;
        const canUpgrade = tier.order > currentPlanOrder;
        const canDowngrade = tier.order < currentPlanOrder && tier.order > 0;

        return (
          <div
            key={tier.id}
            className={`border rounded-lg p-4 ${
              isCurrentPlan
                ? "border-orange-500 bg-orange-50/50"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {tier.name}
                  </h3>
                  <span className="text-gray-600">({tier.price})</span>
                  {isCurrentPlan && (
                    <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Current Plan
                    </Badge>
                  )}
                </div>
                <ul className="space-y-1 text-sm text-gray-600">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ml-4">
                {isCurrentPlan ? (
                  <div className="text-sm text-gray-500 italic">Active</div>
                ) : canUpgrade && tier.lookupKey ? (
                  <Button
                    onClick={() => handleUpgrade(tier.lookupKey!, tier.id)}
                    disabled={loadingPlan === tier.id}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {loadingPlan === tier.id ? (
                      "Loading..."
                    ) : (
                      <>
                        <ArrowUp className="h-4 w-4 mr-1" />
                        Upgrade
                      </>
                    )}
                  </Button>
                ) : canDowngrade ? (
                  <Link
                    href="/account/settings/subscription#manage"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ArrowDown className="h-4 w-4" />
                    Downgrade via portal
                  </Link>
                ) : tier.id === "partner" && !isCurrentPlan ? (
                  <Link href="/contact?subject=partner">
                    <Button variant="outline">Apply</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {currentTier !== "explorer" && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> To downgrade your plan, use the{" "}
            <a
              href="#manage"
              className="underline font-medium"
            >
              Manage Subscription
            </a>{" "}
            button above to access the Stripe Customer Portal where you can cancel
            or modify your subscription.
          </p>
        </div>
      )}
    </div>
  );
}










