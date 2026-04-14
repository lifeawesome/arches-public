"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  // Validation
  if (!email || !password || !firstName || !lastName) {
    redirect("/signup?error=" + encodeURIComponent("Missing required fields"));
  }

  if (password !== confirmPassword) {
    redirect("/signup?error=" + encodeURIComponent("Passwords don't match"));
  }

  if (password.length < 6) {
    redirect("/signup?error=" + encodeURIComponent("Password must be at least 6 characters"));
  }

  // Create user with metadata (all users are experts now)
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
      data: {
        first_name: firstName,
        last_name: lastName,
        user_type: "expert", // All users are experts
        full_name: `${firstName} ${lastName}`.trim(),
      },
    },
  });

  if (error) {
    console.error("Signup error:", error);
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    // User is immediately signed in
    // Create initial profile
    try {
      await supabase.from("profiles").insert({
        id: data.user?.id,
        full_name: `${firstName} ${lastName}`.trim(),
        email: email,
        onboarding_completed: false,
        onboarding_step: 0,
        updated_at: new Date().toISOString(),
      });
    } catch (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail the signup, just log the error
    }

    revalidatePath("/", "layout");
    redirect("/onboarding");
  } else if (data.user && !data.session) {
    // User needs to confirm email - this is the expected flow
    // Create initial profile for email confirmation users
    try {
      await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: `${firstName} ${lastName}`.trim(),
        email: email,
        onboarding_completed: false,
        onboarding_step: 0,
        updated_at: new Date().toISOString(),
      });
    } catch (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail the signup, just log the error
    }

    redirect("/signup?message=check_email");
  }

  redirect("/signup?error=" + encodeURIComponent("Signup failed"));
}

