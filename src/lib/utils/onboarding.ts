import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export interface OnboardingData {
  userType?: "member" | "expert";
  companyName?: string;
  jobTitle?: string;
  expertise?: string[];
  bio?: string;
  website?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  goals?: string[];
  [key: string]: any;
}

export interface OnboardingStatus {
  completed: boolean;
  step: number;
  data: OnboardingData;
}

export async function getOnboardingStatus(
  userId: string
): Promise<OnboardingStatus> {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed, onboarding_step, onboarding_data")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching onboarding status:", error);
    // Return default status if profile doesn't exist
    return {
      completed: false,
      step: 0,
      data: {},
    };
  }

  return {
    completed: profile.onboarding_completed || false,
    step: profile.onboarding_step || 0,
    data: profile.onboarding_data || {},
  };
}

export async function updateOnboardingStep(
  userId: string,
  step: number,
  data: Partial<OnboardingData> = {}
): Promise<void> {
  const supabase = await createClient();

  // Get current onboarding data
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("onboarding_data")
    .eq("id", userId)
    .single();

  const currentData = currentProfile?.onboarding_data || {};
  const updatedData = { ...currentData, ...data };

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_step: step,
      onboarding_data: updatedData,
      onboarding_completed: step >= 5, // Assuming 5 steps total
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Error updating onboarding step:", error);
    throw error;
  }
}

export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      onboarding_step: 5, // Mark as completed
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Error completing onboarding:", error);
    throw error;
  }
}

export async function getCurrentUserOnboardingStatus(): Promise<OnboardingStatus | null> {
  const cookieStore = await cookies();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getOnboardingStatus(user.id);
}
