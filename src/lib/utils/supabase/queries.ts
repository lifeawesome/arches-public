import { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export const getUser = cache(async (supabase: SupabaseClient) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getSubscription = cache(async (supabase: SupabaseClient) => {
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("*")
    .in("status", ["trialing", "active"])
    .maybeSingle();

  if (error) console.log(error);

  return subscription;
});

export const getProducts = cache(async (supabase: SupabaseClient) => {
  // First get products
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("metadata->index");

  if (productsError) {
    console.log(productsError);
    return null;
  }

  if (!products || products.length === 0) {
    return [];
  }

  // Then get prices for those products
  const { data: prices, error: pricesError } = await supabase
    .from("prices")
    .select("*")
    .in("product_id", products.map(p => p.id))
    .eq("active", true)
    .order("unit_amount");

  if (pricesError) {
    console.log(pricesError);
  }

  // Manually join prices to products
  const productsWithPrices = products.map(product => ({
    ...product,
    prices: prices?.filter(price => price.product_id === product.id) || []
  }));

  return productsWithPrices;
});

export const getUserDetails = cache(async (supabase: SupabaseClient) => {
  const { data: userDetails } = await supabase
    .from("users")
    .select("*")
    .single();
  return userDetails;
});

export const getUserProfile = cache(async (supabase: SupabaseClient) => {
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("*")
    .single();
  return userProfile;
});

// Tier management helpers

/**
 * Map Stripe price lookup_key to tier name
 */
export function lookupKeyToTier(lookupKey: string): string | null {
  const tierMap: Record<string, string> = {
    'arches_builder_monthly': 'builder',
    'arches_builder_annual': 'builder',
    'arches_pro_monthly': 'pro',
    'arches_pro_annual': 'pro',
    'arches_partner_monthly': 'partner',
  };
  
  return tierMap[lookupKey] || null;
}

/**
 * Get user's current subscription tier
 */
export const getUserTier = cache(async (supabase: SupabaseClient) => {
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .single();
  
  return profile?.subscription_tier || 'explorer';
});

/**
 * Check if user has access to a specific feature based on tier
 */
export function hasFeatureAccess(userTier: string, requiredTier: string): boolean {
  const tierHierarchy: Record<string, number> = {
    'explorer': 0,
    'builder': 1,
    'pro': 2,
    'partner': 3,
  };
  
  const userLevel = tierHierarchy[userTier] || 0;
  const requiredLevel = tierHierarchy[requiredTier] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * Get subscription with price details including lookup_key
 */
export const getSubscriptionWithPrice = cache(async (supabase: SupabaseClient) => {
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("*, price_id")
    .in("status", ["trialing", "active"])
    .maybeSingle();

  if (error) {
    console.log(error);
    return null;
  }

  if (!subscription) {
    return null;
  }

  // Get the price details including lookup_key
  const { data: price } = await supabase
    .from("prices")
    .select("*, lookup_key")
    .eq("id", subscription.price_id)
    .single();

  return {
    ...subscription,
    price,
  };
});
