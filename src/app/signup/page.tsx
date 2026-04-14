"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Target, Rocket, CheckCircle2, TrendingUp } from "lucide-react";

function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }

    if (messageParam) {
      setMessage(decodeURIComponent(messageParam));
    }
  }, [searchParams]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (formData: FormData): boolean => {
    const errors: { [key: string]: string } = {};

    const email = formData.get("email") as string;
    if (!email) {
      errors.email = "Email is required";
    } else if (!validateEmail(email)) {
      errors.email = "Please enter a valid email address";
    }

    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters long";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords don't match";
    }

    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;

    if (!firstName) {
      errors.firstName = "First name is required";
    }

    if (!lastName) {
      errors.lastName = "Last name is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");
    setFormErrors({});

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (!validateForm(formData)) {
      setIsLoading(false);
      return;
    }

    try {
      // Import and use the signup server action
      const { signup } = await import("./actions");
      await signup(formData);
      // If we reach here, the action redirected successfully
    } catch (error: unknown) {
      // Check if this is a redirect (which is expected)
      if (
        error &&
        typeof error === "object" &&
        "digest" in error &&
        typeof error.digest === "string" &&
        error.digest.includes("NEXT_REDIRECT")
      ) {
        // This is a redirect, not an error - let the redirect happen
        return;
      }

      // Check if we have a message parameter (email confirmation success)
      const messageParam = searchParams.get("message");
      if (messageParam) {
        // We have a success message, don't show error
        return;
      }

      console.error("Signup error:", error);
      setError("An error occurred during signup");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/30">
      <div className="container mx-auto px-4 py-12 lg:py-20">
        <div className="max-w-7xl mx-auto">
          {/* 2-Column Layout */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Column - Benefits & Info */}
            <div className="space-y-8">
              {/* Header */}
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                  Start Your Expert Growth Journey
                </h1>
                <p className="text-xl text-muted-foreground">
                  Join Arches Network and build the confidence, clarity, and credibility you need to become the expert you already are.
                </p>
              </div>

              {/* Benefits Cards */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  What You Get
                </h3>

                <div className="space-y-3">
                  <div className="rounded-lg border-2 border-border bg-background p-4 transition-colors hover:border-primary/50">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Daily Growth Actions</h4>
                        <p className="text-sm text-muted-foreground">
                          15-30 minute daily tasks designed to build your expertise step by step
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-border bg-background p-4 transition-colors hover:border-primary/50">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Structured Pathways</h4>
                        <p className="text-sm text-muted-foreground">
                          Clear progression paths for confidence, positioning, authority, and more
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-border bg-background p-4 transition-colors hover:border-primary/50">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Track Your Progress</h4>
                        <p className="text-sm text-muted-foreground">
                          XP, streaks, and achievements to celebrate every step forward
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="rounded-lg border-2 border-border bg-background/80 backdrop-blur p-6">
                <div className="flex items-start gap-3">
                  <div className="mt-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <div className="space-y-1">
                    <p className="font-semibold">Start at $9/month</p>
                    <p className="text-sm text-muted-foreground">
                      Affordable daily growth • Cancel anytime • No long-term commitment
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Signup Form */}
            <div className="lg:sticky lg:top-8">
              <div className="rounded-2xl border-2 border-border bg-background shadow-xl p-6 lg:p-8">
                <div className="space-y-2 mb-6">
                  <h2 className="text-2xl font-bold">Create Your Account</h2>
                  <p className="text-sm text-muted-foreground">
                    Join as an expert and start your growth journey today.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="mb-6 rounded-lg border border-primary/50 bg-primary/10 p-4 text-sm">
                    <h3 className="font-semibold mb-2">Check your email</h3>
                    <p className="text-muted-foreground">
                      We&apos;ve sent you a confirmation email. Please check your inbox and click the confirmation link to complete your account setup.
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      After confirming your email, you&apos;ll be redirected to complete your profile.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSignup} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="text-sm font-medium">
                        First name
                      </label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        autoComplete="given-name"
                        placeholder="First name"
                        className={`w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          formErrors.firstName ? "border-destructive" : ""
                        }`}
                      />
                      {formErrors.firstName && (
                        <p className="text-xs text-destructive">{formErrors.firstName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="lastName" className="text-sm font-medium">
                        Last name
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        autoComplete="family-name"
                        placeholder="Last name"
                        className={`w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          formErrors.lastName ? "border-destructive" : ""
                        }`}
                      />
                      {formErrors.lastName && (
                        <p className="text-xs text-destructive">{formErrors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={`w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        formErrors.email ? "border-destructive" : ""
                      }`}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-destructive">{formErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Create a password (min 6 characters)"
                      className={`w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        formErrors.password ? "border-destructive" : ""
                      }`}
                    />
                    {formErrors.password && (
                      <p className="text-xs text-destructive">{formErrors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Confirm your password"
                      className={`w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        formErrors.confirmPassword ? "border-destructive" : ""
                      }`}
                    />
                    {formErrors.confirmPassword && (
                      <p className="text-xs text-destructive">{formErrors.confirmPassword}</p>
                    )}
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      id="terms"
                      name="terms"
                      type="checkbox"
                      required
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="terms" className="text-sm leading-relaxed">
                      I agree to the{" "}
                      <Link href="/terms" className="text-primary hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isLoading ? "Creating account..." : "Start Your Journey →"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="font-medium text-primary hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}

