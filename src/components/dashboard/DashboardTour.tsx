"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";

interface DashboardTourProps {
  run: boolean;
  onComplete: () => void;
}

const TOUR_STORAGE_KEY = "arches_dashboard_tour_completed";

const steps: Step[] = [
  {
    target: '[data-tour="welcome-card"]',
    title: "Welcome to Arches",
    content:
      "This is your home base. Everything here revolves around small daily actions that help you grow as an expert.\n\nYour first step is choosing a pathway.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="no-task"]',
    title: "No task yet and that's okay",
    content:
      "You don't have a daily action because you haven't chosen a pathway yet.\n\nPick a pathway, and Arches will assign you focused, daily steps automatically.",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="xp-streak"]',
    title: "Progress, not pressure",
    content:
      "XP and streaks track consistency, not perfection.\n\nOne small action a day is how momentum is built here.",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: '[data-tour="bottom-nav-paths"]',
    title: "How you move around Arches",
    content:
      "• Paths is where you choose what you're growing\n• Action is where today's task lives\n\nYou'll spend most of your time there.",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: "body",
    title: "You're ready",
    content:
      "Choose a pathway and complete your first daily action.\n\nThat's how Arches works. Simple. Intentional. Daily.",
    placement: "center",
    disableBeacon: true,
  },
];

export function DashboardTour({ run, onComplete }: DashboardTourProps) {
  const [tourRun, setTourRun] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (run) {
      // Check if tour was already completed
      const tourCompleted = typeof window !== "undefined" && localStorage.getItem(TOUR_STORAGE_KEY);
      if (!tourCompleted) {
        // Small delay to ensure DOM is ready and target elements exist
        timer = setTimeout(() => {
          setTourRun(true);
          // Add tour-active class to body for z-index management
          if (typeof document !== "undefined") {
            document.body.classList.add("tour-active");
          }
        }, 100);
      } else {
        // Tour already completed, don't run
        // Do not update state synchronously in effect (avoids cascading renders)
      }
    } else {
      // Do not update state synchronously in effect (avoids cascading renders)
      // Remove tour-active class when tour stops
      if (typeof document !== "undefined") {
        document.body.classList.remove("tour-active");
      }
    }

    // Cleanup: remove class on unmount and clear timer
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      if (typeof document !== "undefined") {
        document.body.classList.remove("tour-active");
      }
    };
  }, [run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action } = data;

    // Handle skip action
    if (action === "skip" || status === STATUS.SKIPPED) {
      if (typeof window !== "undefined") {
        localStorage.setItem(TOUR_STORAGE_KEY, "true");
      }
      setTourRun(false);
      // Remove tour-active class
      if (typeof document !== "undefined") {
        document.body.classList.remove("tour-active");
      }
      onComplete();
      return;
    }

    // Handle tour completion
    if (status === STATUS.FINISHED) {
      if (typeof window !== "undefined") {
        localStorage.setItem(TOUR_STORAGE_KEY, "true");
      }
      setTourRun(false);
      // Remove tour-active class
      if (typeof document !== "undefined") {
        document.body.classList.remove("tour-active");
      }
      onComplete();

      // Navigate to paths page when tour completes
      setTimeout(() => {
        router.push("/dashboard/paths");
      }, 100);
      return;
    }
  };

  if (!tourRun) {
    return null;
  }

  return (
    <Joyride
      key="dashboard-tour"
      steps={steps}
      run={tourRun}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose={false}
      disableScrolling={true}
      callback={handleJoyrideCallback}
      floaterProps={{
        disableAnimation: false,
        styles: {
          floater: {
            zIndex: 10000,
          },
        },
      }}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--background))",
          overlayColor: "rgba(0, 0, 0, 0.5)",
          arrowColor: "hsl(var(--background))",
          zIndex: 10000,
        },
        overlay: {
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          mixBlendMode: "normal",
        },
        spotlight: {
          borderRadius: "0.5rem",
          backgroundColor: "transparent",
          border: "3px solid hsl(var(--primary))",
          mixBlendMode: "luminosity",
          boxShadow:
            "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 3px rgba(255, 255, 255, 1), 0 0 30px 6px rgba(255, 255, 255, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.3)",
        },
        tooltip: {
          borderRadius: "0.5rem",
          padding: "1.5rem",
          backgroundColor: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          opacity: "1",
        },
        tooltipContainer: {
          textAlign: "left",
        },
        tooltipTitle: {
          fontSize: "1.125rem",
          fontWeight: "700",
          marginBottom: "0.5rem",
        },
        tooltipContent: {
          fontSize: "0.875rem",
          lineHeight: "1.5",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          fontWeight: "600",
          border: "none",
          cursor: "pointer",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          marginRight: "0.5rem",
          fontSize: "0.875rem",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
          fontSize: "0.875rem",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Choose My First Path →",
        next: "Next",
        skip: "Skip for now",
      }}
    />
  );
}
