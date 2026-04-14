"use server";

import Stripe from "stripe";
import { stripe } from "@/lib/utils/stripe/config";
import { createClient } from "@/utils/supabase/server";
import { createOrRetrieveCustomer } from "@/lib/utils/supabase/admin";
import {
  getURL,
  getErrorRedirect,
  calculateTrialEndUnixTimestamp,
} from "@/lib/utils/helpers";
import { Tables } from "@/types_db";

type Price = Tables<"prices">;

type CheckoutResponse = {
  errorRedirect?: string;
  sessionId?: string;
};

export async function checkoutWithStripe(
  price: Price,
  redirectPath: string = "/account"
): Promise<CheckoutResponse> {
  try {
    // Get the user from Supabase auth
    const supabase = await createClient();
    const {
      error,
      data: { user },
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error(error);
      throw new Error("Could not get user session.");
    }

    // Retrieve or create the customer in Stripe
    let customer: string;
    try {
      customer = await createOrRetrieveCustomer({
        uuid: user?.id || "",
        email: user?.email ?? "",
      });
    } catch (err) {
      console.error(err);
      throw new Error("Unable to access customer record.");
    }

    let params: Stripe.Checkout.SessionCreateParams = {
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer,
      customer_update: {
        address: "auto",
      },
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      cancel_url: getURL("/account"),
      success_url: getURL(redirectPath),
    };

    console.log(
      "Trial end:",
      calculateTrialEndUnixTimestamp(price.trial_period_days)
    );
    if (price.type === "recurring") {
      const trialEnd = calculateTrialEndUnixTimestamp(price.trial_period_days);
      params = {
        ...params,
        mode: "subscription",
        subscription_data: trialEnd ? {
          trial_end: trialEnd,
        } : {},
      };
    } else if (price.type === "one_time") {
      params = {
        ...params,
        mode: "payment",
      };
    }

    // Create a checkout session in Stripe
    let session;
    try {
      console.log("Creating checkout session with params:", JSON.stringify(params, null, 2));
      session = await stripe.checkout.sessions.create(params);
      console.log("Checkout session created successfully:", session.id);
    } catch (err) {
      console.error("Stripe checkout session creation failed:", err);
      throw new Error("Unable to create checkout session.");
    }

    // Instead of returning a Response, just return the data or error.
    if (session) {
      return { sessionId: session.id };
    } else {
      throw new Error("Unable to create checkout session.");
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        errorRedirect: getErrorRedirect(
          redirectPath,
          error.message,
          "Please try again later or contact a system administrator."
        ),
      };
    } else {
      return {
        errorRedirect: getErrorRedirect(
          redirectPath,
          "An unknown error occurred.",
          "Please try again later or contact a system administrator."
        ),
      };
    }
  }
}

export async function createStripePortal(currentPath: string) {
  try {
    const supabase = await createClient();
    const {
      error,
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (error) {
        console.error(error);
      }
      throw new Error("Could not get user session.");
    }

    // Get customer ID directly from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      console.error("No Stripe customer ID found in profile:", profileError);
      throw new Error("Unable to access customer record.");
    }

    const customerId = profile.stripe_customer_id;

    try {
      const { url } = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: getURL("/account"),
      });
      if (!url) {
        throw new Error("Could not create billing portal");
      }
      return url;
    } catch (err) {
      console.error(err);
      throw new Error("Could not create billing portal");
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return getErrorRedirect(
        currentPath,
        error.message,
        "Please try again later or contact a system administrator."
      );
    } else {
      return getErrorRedirect(
        currentPath,
        "An unknown error occurred.",
        "Please try again later or contact a system administrator."
      );
    }
  }
}
