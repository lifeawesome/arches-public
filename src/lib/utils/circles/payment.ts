// Circle Payment Utilities
// Functions to handle Stripe payments for circles, events, and sessions

import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import type { Circle } from '@/types/circles';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover' as any,
});

// ============================================================================
// CIRCLE SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Create a Stripe product and price for a paid circle
 */
export async function createCircleStripeProduct(
  circle: Circle
): Promise<{ productId: string; priceId: string }> {
  if (!circle.price_cents) {
    throw new Error('Circle must have a price set');
  }
  
  // Create product
  const product = await stripe.products.create({
    name: `Circle: ${circle.name}`,
    description: circle.description || undefined,
    metadata: {
      circle_id: circle.id,
      type: 'circle_subscription',
    },
  });
  
  // Create recurring price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: circle.price_cents,
    currency: 'usd',
    recurring: {
      interval: 'month',
    },
    metadata: {
      circle_id: circle.id,
    },
  });
  
  // Update circle with Stripe IDs
  const supabase = await createClient();
  await supabase
    .from('circles')
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
    })
    .eq('id', circle.id);
  
  return {
    productId: product.id,
    priceId: price.id,
  };
}

/**
 * Create a Stripe checkout session for joining a paid circle
 */
export async function createCircleCheckoutSession(
  circleId: string,
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const supabase = await createClient();
  
  // Get circle details
  const { data: circle, error } = await supabase
    .from('circles')
    .select('*')
    .eq('id', circleId)
    .single();
  
  if (error || !circle) {
    throw new Error('Circle not found');
  }
  
  if (!circle.stripe_price_id) {
    throw new Error('Circle does not have Stripe price configured');
  }

  if ((circle as { status?: string }).status !== 'active') {
    throw new Error('This circle is not accepting new memberships');
  }
  
  // Get user's email
  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData.user?.email;
  
  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  
  let customerId = profile?.stripe_customer_id;
  
  if (!customerId && userEmail) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: {
        user_id: userId,
      },
    });
    customerId = customer.id;
    
    // Save customer ID
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);
  }
  
  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: circle.stripe_price_id,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      circle_id: circleId,
      user_id: userId,
      type: 'circle_subscription',
    },
    subscription_data: {
      metadata: {
        circle_id: circleId,
        user_id: userId,
      },
    },
  });
  
  return session.url!;
}

/**
 * Handle successful circle subscription payment
 */
export async function handleCircleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const circleId = subscription.metadata.circle_id;
  const userId = subscription.metadata.user_id;
  
  if (!circleId || !userId) {
    throw new Error('Missing metadata in subscription');
  }
  
  const supabase = await createClient();

  const { data: circleRow } = await supabase
    .from('circles')
    .select('status')
    .eq('id', circleId)
    .single();
  if (!circleRow || (circleRow as { status: string }).status !== 'active') {
    console.warn('handleCircleSubscriptionCreated: circle not active, skipping membership upsert', circleId);
    return;
  }

  // Create or update membership
  await supabase
    .from('circle_memberships')
    .upsert({
      circle_id: circleId,
      user_id: userId,
      membership_type: 'paid',
      status: 'active',
      stripe_subscription_id: subscription.id,
      expires_at: new Date((subscription as any).current_period_end * 1000).toISOString(),
    });
}

/**
 * Handle circle subscription cancellation
 */
export async function handleCircleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('circle_memberships')
    .update({
      status: 'cancelled',
    })
    .eq('stripe_subscription_id', subscription.id);
}

/**
 * Handle circle subscription renewal
 */
export async function handleCircleSubscriptionRenewed(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('circle_memberships')
    .update({
      status: 'active',
      expires_at: new Date((subscription as any).current_period_end * 1000).toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

// ============================================================================
// EVENT PAYMENT MANAGEMENT
// ============================================================================

/**
 * Create a payment intent for a paid event
 */
export async function createEventPaymentIntent(
  eventId: string,
  userId: string
): Promise<string> {
  const supabase = await createClient();
  
  // Get event details
  const { data: event, error } = await supabase
    .from('circle_events')
    .select('*, circles(name)')
    .eq('id', eventId)
    .single();
  
  if (error || !event || !event.price_cents) {
    throw new Error('Event not found or not paid');
  }
  
  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  
  let customerId = profile?.stripe_customer_id;
  
  if (!customerId) {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email;
    
    if (userEmail) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_id: userId,
        },
      });
      customerId = customer.id;
      
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }
  }
  
  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: event.price_cents,
    currency: 'usd',
    customer: customerId,
    metadata: {
      event_id: eventId,
      user_id: userId,
      type: 'event_registration',
    },
    description: `Event: ${event.title} (${event.circles?.name})`,
  });
  
  return paymentIntent.client_secret!;
}

/**
 * Handle successful event payment
 */
export async function handleEventPaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const eventId = paymentIntent.metadata.event_id;
  const userId = paymentIntent.metadata.user_id;
  
  if (!eventId || !userId) {
    throw new Error('Missing metadata in payment intent');
  }
  
  const supabase = await createClient();
  
  // Update registration payment status
  await supabase
    .from('circle_event_registrations')
    .update({
      payment_status: 'completed',
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq('event_id', eventId)
    .eq('user_id', userId);
}

// ============================================================================
// SESSION PAYMENT MANAGEMENT
// ============================================================================

/**
 * Create a payment intent for a paid session
 */
export async function createSessionPaymentIntent(
  sessionId: string,
  userId: string
): Promise<string> {
  const supabase = await createClient();
  
  // Get session details
  const { data: session, error } = await supabase
    .from('circle_sessions')
    .select('*, circles(name)')
    .eq('id', sessionId)
    .single();
  
  if (error || !session || !session.price_cents) {
    throw new Error('Session not found or not paid');
  }
  
  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  
  let customerId = profile?.stripe_customer_id;
  
  if (!customerId) {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email;
    
    if (userEmail) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_id: userId,
        },
      });
      customerId = customer.id;
      
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }
  }
  
  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: session.price_cents,
    currency: 'usd',
    customer: customerId,
    metadata: {
      session_id: sessionId,
      user_id: userId,
      type: 'session_booking',
    },
    description: `Session: ${session.title} (${session.circles?.name})`,
  });
  
  return paymentIntent.client_secret!;
}

/**
 * Handle successful session payment
 */
export async function handleSessionPaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const sessionId = paymentIntent.metadata.session_id;
  const userId = paymentIntent.metadata.user_id;
  
  if (!sessionId || !userId) {
    throw new Error('Missing metadata in payment intent');
  }
  
  const supabase = await createClient();
  
  // Update booking payment status
  await supabase
    .from('circle_session_bookings')
    .update({
      payment_status: 'completed',
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq('session_id', sessionId)
    .eq('user_id', userId);
}

// ============================================================================
// REFUND MANAGEMENT
// ============================================================================

/**
 * Refund an event registration
 */
export async function refundEventRegistration(
  registrationId: string
): Promise<void> {
  const supabase = await createClient();
  
  const { data: registration } = await supabase
    .from('circle_event_registrations')
    .select('stripe_payment_intent_id')
    .eq('id', registrationId)
    .single();
  
  if (!registration?.stripe_payment_intent_id) {
    throw new Error('No payment intent found for registration');
  }
  
  // Create refund
  await stripe.refunds.create({
    payment_intent: registration.stripe_payment_intent_id,
  });
  
  // Update registration
  await supabase
    .from('circle_event_registrations')
    .update({
      payment_status: 'refunded',
      status: 'cancelled',
    })
    .eq('id', registrationId);
}

/**
 * Refund a session booking
 */
export async function refundSessionBooking(
  bookingId: string
): Promise<void> {
  const supabase = await createClient();
  
  const { data: booking } = await supabase
    .from('circle_session_bookings')
    .select('stripe_payment_intent_id')
    .eq('id', bookingId)
    .single();
  
  if (!booking?.stripe_payment_intent_id) {
    throw new Error('No payment intent found for booking');
  }
  
  // Create refund
  await stripe.refunds.create({
    payment_intent: booking.stripe_payment_intent_id,
  });
  
  // Update booking
  await supabase
    .from('circle_session_bookings')
    .update({
      payment_status: 'refunded',
      status: 'cancelled',
    })
    .eq('id', bookingId);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get circle revenue analytics
 */
export async function getCircleRevenue(circleId: string): Promise<number> {
  const supabase = await createClient();
  
  // Get paid memberships
  const { data: memberships } = await supabase
    .from('circle_memberships')
    .select('stripe_subscription_id')
    .eq('circle_id', circleId)
    .eq('membership_type', 'paid')
    .not('stripe_subscription_id', 'is', null);
  
  if (!memberships || memberships.length === 0) {
    return 0;
  }
  
  let totalRevenue = 0;
  
  // Fetch subscription data from Stripe
  for (const membership of memberships) {
    if (membership.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          membership.stripe_subscription_id
        );
        
        // Calculate total amount paid
        const invoices = await stripe.invoices.list({
          subscription: subscription.id,
          status: 'paid',
        });
        
        totalRevenue += invoices.data.reduce((sum, invoice) => sum + invoice.amount_paid, 0);
      } catch (error) {
        console.error('Error fetching subscription revenue:', error);
      }
    }
  }
  
  return totalRevenue;
}

