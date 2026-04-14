"use client";

import { Button } from "@/components/ui/button";
import { createStripePortal } from "@/lib/utils/stripe/server";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ManageSubscriptionButtonProps {
  currentPath: string;
}

export function ManageSubscriptionButton({
  currentPath,
}: ManageSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const portalUrl = await createStripePortal(currentPath);
      if (portalUrl.startsWith("/")) {
        // It's an error redirect
        router.push(portalUrl);
      } else {
        // It's a Stripe portal URL
        window.location.href = portalUrl;
      }
    } catch (error) {
      console.error("Error creating billing portal:", error);
      router.push(`${currentPath}?error=billing_portal_error`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="mt-4 w-full"
      onClick={handleManageSubscription}
      disabled={isLoading}
    >
      {isLoading ? "Loading..." : "Manage Subscription"}
    </Button>
  );
}
