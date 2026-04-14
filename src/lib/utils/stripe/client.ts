import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
        ""
    );
  }

  return stripePromise;
};

/**
 * Handle Stripe checkout by creating a session and redirecting to Stripe
 * @param lookupKey - The Stripe price lookup key (e.g., 'arches_builder_monthly')
 * @param returnUrl - The URL to return to after checkout (default: '/account')
 */
export async function handleStripeCheckout(
  lookupKey: string,
  returnUrl: string = '/account'
): Promise<void> {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lookupKey,
      returnUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create checkout session');
  }

  if (data.url) {
    // Redirect to Stripe Checkout
    window.location.href = data.url;
  } else {
    throw new Error('No checkout URL returned');
  }
}

