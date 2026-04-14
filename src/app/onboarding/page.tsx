"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Zap, TrendingUp, Award, Clock, Target } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { getAvailablePathways, enrollInPathway } from "@/lib/pathways/queries";
import type { Pathway } from "@/lib/pathways/queries";
import { assignFirstTaskToUser } from "@/lib/pathways/task-assignment";

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "Welcome! Let's get to know you",
    description:
      "We're here to help you grow as an expert. Let's start by understanding where you are in your journey.",
  },
  {
    id: 2,
    title: "Do you run a business?",
    description:
      "This helps us tailor your experience and suggest relevant pathways.",
  },
  {
    id: 3,
    title: "What kind of expert are you?",
    description:
      "Tell us about your expertise so we can match you with the right growth opportunities.",
  },
  {
    id: 4,
    title: "What are your goals?",
    description:
      "Understanding your goals helps us guide you to the most valuable pathways.",
  },
  {
    id: 5,
    title: "Almost there!",
    description:
      "Let's finish up with a few quick questions about your experience.",
  },
  {
    id: 6,
    title: "Choose Your First Growth Path",
    description:
      "Select a pathway to start your expert journey. You can add more later.",
  },
  {
    id: 7,
    title: "How Arches Works",
    description:
      "Let's quickly explain how you'll grow and track your progress.",
  },
];

const BUSINESS_TYPES = [
  {
    id: "consultant",
    label: "Consultant",
    description: "Provide advice and services to clients",
  },
  {
    id: "coach",
    label: "Coach",
    description: "Help others achieve their goals",
  },
  {
    id: "freelancer",
    label: "Freelancer / Independent Contractor",
    description: "Work on projects for multiple clients",
  },
  {
    id: "agency",
    label: "Agency/Studio",
    description: "Run a team or small business",
  },
  {
    id: "creator",
    label: "Creator",
    description: "Create content, courses, or digital products",
  },
  {
    id: "speaker",
    label: "Speaker",
    description: "Speak at events or host workshops",
  },
  {
    id: "employee",
    label: "Employee / Individual Contributor",
    description: "Work within a company but building expertise",
  },
  { id: "other", label: "Other", description: "Something else entirely" },
];

const EXPERT_TYPES = [
  "Marketing & Growth",
  "Design & UX",
  "Development & Engineering",
  "Product Management",
  "Business Strategy",
  "Sales & Revenue",
  "Leadership & Management",
  "Content & Writing",
  "Data & Analytics",
  "Operations & Process",
  "Finance & Accounting",
  "HR & People Ops",
  "Legal & Compliance",
  "Healthcare & Wellness",
  "Education & Training",
  "Other",
];

const GROWTH_GOALS = [
  "Build more confidence in my expertise",
  "Clarify my positioning and niche",
  "Increase my visibility and authority",
  "Improve my messaging and communication",
  "Learn to price my services better",
  "Attract higher-quality clients",
  "Build a stronger personal brand",
  "Create consistent content",
  "Develop speaking opportunities",
  "Scale my business",
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Form data state
  const [formData, setFormData] = useState({
    businessType: "",
    businessTypeOther: "",
    expertTypes: [] as string[],
    growthGoals: [] as string[],
    yearsOfExperience: "",
    currentChallenges: "",
    location: "",
    website: "",
    selectedPathwayId: "",
  });

  // Pathway selection state
  const [availablePathways, setAvailablePathways] = useState<Pathway[]>([]);
  const [pathwaysLoading, setPathwaysLoading] = useState(false);
  const [firstTaskId, setFirstTaskId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
    };

    getUser();
  }, [supabase.auth, router]);

  // Fetch pathways when reaching step 6
  useEffect(() => {
    if (currentStep === 6 && availablePathways.length === 0 && !pathwaysLoading) {
      const fetchPathways = async () => {
        setPathwaysLoading(true);
        try {
          const pathways = await getAvailablePathways(supabase);
          setAvailablePathways(pathways);
        } catch (error) {
          console.error("Error fetching pathways:", error);
        } finally {
          setPathwaysLoading(false);
        }
      };
      fetchPathways();
    }
  }, [currentStep, supabase, availablePathways.length, pathwaysLoading]);

  const updateFormData = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (
    field: "expertTypes" | "growthGoals",
    item: string
  ) => {
    setFormData((prev) => {
      const currentArray = prev[field];
      const newArray = currentArray.includes(item)
        ? currentArray.filter((i) => i !== item)
        : [...currentArray, item];
      return { ...prev, [field]: newArray };
    });
  };

  const handleNext = async () => {
    // Validate current step
    if (currentStep === 2 && !formData.businessType) {
      return;
    }
    if (currentStep === 3 && formData.expertTypes.length === 0) {
      return;
    }
    if (currentStep === 4 && formData.growthGoals.length === 0) {
      return;
    }
    if (currentStep === 6 && !formData.selectedPathwayId) {
      return;
    }

    // Handle pathway enrollment on step 6
    if (currentStep === 6 && formData.selectedPathwayId && user) {
      setIsLoading(true);
      try {
        // Enroll in pathway (this will assign first task automatically)
        await enrollInPathway(supabase, user.id, formData.selectedPathwayId, true);

        // Get the first task ID for redirect (in case it wasn't set during enrollment)
        const taskId = await assignFirstTaskToUser(supabase, user.id, formData.selectedPathwayId);
        if (taskId) {
          setFirstTaskId(taskId);
        }
      } catch (error) {
        console.error("Error enrolling in pathway:", error);
        alert("Failed to enroll in pathway. Please try again.");
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    if (currentStep < ONBOARDING_STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    // Validate pathway is selected
    if (!formData.selectedPathwayId) {
      alert("Please select a pathway to continue.");
      return;
    }

    setIsLoading(true);
    try {
      // Update the profile with onboarding completion
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_step: 7,
          onboarding_data: formData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      // Small delay to ensure state propagates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirect to first task action page if task ID is available
      if (firstTaskId) {
        router.push(`/dashboard/action?task=${firstTaskId}`);
      } else {
        // Fallback: try to get today's task
        const taskId = await assignFirstTaskToUser(supabase, user.id, formData.selectedPathwayId);
        if (taskId) {
          router.push(`/dashboard/action?task=${taskId}`);
        } else {
          // Last fallback: redirect to dashboard
          router.push("/dashboard");
        }
      }
      router.refresh();
    } catch (error) {
      console.error("Error completing onboarding:", error);
      // Still redirect to dashboard on error
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border-2 border-border bg-muted/30 p-6">
              <h3 className="font-semibold mb-3">Why we ask these questions</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your answers help us:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Recommend the right growth pathways for you</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Personalize your daily tasks and guidance</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>Connect you with relevant resources and community</span>
                </li>
              </ul>
            </div>
            <div className="text-center text-muted-foreground">
              <p>This will only take a few minutes. Let&apos;s get started!</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select the option that best describes your current situation:
            </p>
            <div className="grid gap-3">
              {BUSINESS_TYPES.map((type) => (
                <label
                  key={type.id}
                  className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${formData.businessType === type.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <input
                    type="radio"
                    name="businessType"
                    value={type.id}
                    checked={formData.businessType === type.id}
                    onChange={(e) =>
                      updateFormData("businessType", e.target.value)
                    }
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{type.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {type.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {formData.businessType === "other" && (
              <div className="mt-4">
                <label
                  htmlFor="businessTypeOther"
                  className="block text-sm font-medium mb-2"
                >
                  Please describe your business type
                </label>
                <input
                  id="businessTypeOther"
                  type="text"
                  value={formData.businessTypeOther}
                  onChange={(e) =>
                    updateFormData("businessTypeOther", e.target.value)
                  }
                  placeholder="E.g., Therapist, Financial Advisor, etc."
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select all areas where you have expertise (you can select
              multiple):
            </p>
            <div className="grid grid-cols-2 gap-3">
              {EXPERT_TYPES.map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-colors ${formData.expertTypes.includes(type)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.expertTypes.includes(type)}
                    onChange={() => toggleArrayItem("expertTypes", type)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              What are your main growth goals? Select all that apply:
            </p>
            <div className="space-y-2">
              {GROWTH_GOALS.map((goal) => (
                <label
                  key={goal}
                  className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${formData.growthGoals.includes(goal)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.growthGoals.includes(goal)}
                    onChange={() => toggleArrayItem("growthGoals", goal)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{goal}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="yearsOfExperience"
                  className="block text-sm font-medium mb-2"
                >
                  How many years of professional experience do you have?
                </label>
                <select
                  id="yearsOfExperience"
                  value={formData.yearsOfExperience}
                  onChange={(e) =>
                    updateFormData("yearsOfExperience", e.target.value)
                  }
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select...</option>
                  <option value="0-1">0-1 years</option>
                  <option value="2-5">2-5 years</option>
                  <option value="6-10">6-10 years</option>
                  <option value="11-15">11-15 years</option>
                  <option value="16+">16+ years</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="currentChallenges"
                  className="block text-sm font-medium mb-2"
                >
                  What&apos;s your biggest challenge right now? (optional)
                </label>
                <textarea
                  id="currentChallenges"
                  value={formData.currentChallenges}
                  onChange={(e) =>
                    updateFormData("currentChallenges", e.target.value)
                  }
                  placeholder="E.g., I struggle with pricing, I need more confidence..."
                  rows={3}
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium mb-2"
                >
                  Location (optional)
                </label>
                <input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => updateFormData("location", e.target.value)}
                  placeholder="City, Country"
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label
                  htmlFor="website"
                  className="block text-sm font-medium mb-2"
                >
                  Website or LinkedIn (optional)
                </label>
                <input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateFormData("website", e.target.value)}
                  placeholder="https://yourwebsite.com or https://linkedin.com/in/you"
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select your first growth pathway. This will be your starting point for daily actions and progress tracking.
            </p>
            {pathwaysLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-64 animate-pulse rounded-lg border-2 border-border bg-muted"
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {availablePathways.map((pathway) => (
                  <label
                    key={pathway.id}
                    className={`flex flex-col gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${formData.selectedPathwayId === pathway.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="pathway"
                        value={pathway.id}
                        checked={formData.selectedPathwayId === pathway.id}
                        onChange={(e) =>
                          updateFormData("selectedPathwayId", e.target.value)
                        }
                        className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-lg mb-1">
                          {pathway.title}
                        </div>
                        {pathway.summary && (
                          <div className="text-sm text-muted-foreground">
                            {pathway.summary}
                          </div>
                        )}
                        {pathway.estimated_days && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Estimated: {pathway.estimated_days} days
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {availablePathways.length === 0 && !pathwaysLoading && (
              <div className="rounded-lg border-2 border-border bg-muted/30 p-8 text-center">
                <p className="text-muted-foreground">
                  No pathways available at the moment. Please contact support.
                </p>
              </div>
            )}
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border-2 border-border bg-muted/30 p-6">
              <h3 className="font-semibold mb-4 text-lg">Here&apos;s how Arches works:</h3>

              <div className="space-y-6">
                {/* XP Explanation */}
                <div className="flex gap-4">
                  <div className="rounded-full bg-primary/20 p-3 shrink-0">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">XP (Experience Points)</h4>
                    <p className="text-sm text-muted-foreground">
                      Earn XP by completing daily tasks. Each task gives you points based on its difficulty and value. Track your progress and level up as you grow.
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Example: Complete a task → Earn 25 XP
                    </div>
                  </div>
                </div>

                {/* Streaks Explanation */}
                <div className="flex gap-4">
                  <div className="rounded-full bg-primary/20 p-3 shrink-0">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Streaks</h4>
                    <p className="text-sm text-muted-foreground">
                      Build momentum by completing tasks daily. Your streak grows each day you complete an action. Keep it going to unlock achievements and maintain your growth rhythm.
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Example: Complete today → Streak: 🔥 1 day
                    </div>
                  </div>
                </div>

                {/* Daily Actions Explanation */}
                <div className="flex gap-4">
                  <div className="rounded-full bg-primary/20 p-3 shrink-0">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Daily Actions</h4>
                    <p className="text-sm text-muted-foreground">
                      Each day, you&apos;ll have a focused task (15-30 minutes) from your chosen pathway. These bite-sized actions compound into significant growth over time.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>15-30 min per task</span>
                      <Award className="h-3 w-3 ml-2" />
                      <span>XP rewards included</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
              <p className="text-sm font-medium">
                Ready to start? You&apos;ll be taken to your first task after completing setup!
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border-2 border-border bg-background shadow-xl p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8 text-center">
              <h1 className="mb-3 text-3xl font-bold md:text-4xl">
                {ONBOARDING_STEPS[currentStep - 1].title}
              </h1>
              <p className="text-muted-foreground">
                {ONBOARDING_STEPS[currentStep - 1].description}
              </p>
            </div>

            {/* Progress indicator */}
            <OnboardingChecklist
              currentStep={currentStep}
              totalSteps={ONBOARDING_STEPS.length}
              stepTitles={ONBOARDING_STEPS.map((step) => step.title)}
            />

            {/* Step content */}
            <div className="mb-8 min-h-[400px]">{renderStepContent()}</div>

            {/* Navigation */}
            <div className="flex justify-between gap-4 border-t border-border pt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {currentStep === ONBOARDING_STEPS.length
                  ? "Complete Setup"
                  : "Next"}
                {currentStep < ONBOARDING_STEPS.length && (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Skip option (optional) */}
            {currentStep === 1 && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
