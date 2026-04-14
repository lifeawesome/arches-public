"use client";

import { Check } from "lucide-react";

interface OnboardingChecklistProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}

export function OnboardingChecklist({
  currentStep,
  totalSteps,
  stepTitles,
}: OnboardingChecklistProps) {
  return (
    <div className="mb-8">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-2">
        {stepTitles.map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div
              key={stepNumber}
              className={`h-2 rounded-full transition-all duration-300 ${
                isCurrent
                  ? "w-8 bg-primary"
                  : isCompleted
                  ? "w-2 bg-primary/60"
                  : "w-2 bg-muted"
              }`}
            />
          );
        })}
      </div>

      {/* Step counter */}
      <div className="text-center text-xs text-muted-foreground mb-4">
        Step {currentStep} of {totalSteps}
      </div>

      {/* Checklist items (optional - can be expanded later) */}
      <div className="hidden md:flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        {stepTitles.map((title, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div
              key={stepNumber}
              className={`flex items-center gap-1.5 ${
                isCompleted
                  ? "text-primary"
                  : isCurrent
                  ? "text-foreground font-medium"
                  : ""
              }`}
            >
              {isCompleted && <Check className="h-3 w-3" />}
              <span className={isCurrent ? "font-medium" : ""}>
                {isCompleted ? title : stepNumber === currentStep ? title : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
