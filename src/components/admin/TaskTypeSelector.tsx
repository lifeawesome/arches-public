"use client";

import { TASK_TYPE_SLUGS, type TaskTypeSlug } from "@/lib/admin/level-task-queries";

interface TaskTypeSelectorProps {
  selectedSlug: TaskTypeSlug;
  onSelect: (slug: TaskTypeSlug) => void;
  disabled?: boolean;
}

const taskTypeDisplayNames: Record<TaskTypeSlug, string> = {
  "read-text": "Read Text",
  "watch-video": "Watch Video",
  "take-quiz": "Take Quiz",
  "follow-guide": "Follow Guide",
  "scavenger-hunt": "Scavenger Hunt",
  "read-quote": "Read Quote",
  "create-content": "Create Content",
  "refine-content": "Refine Content",
  "publish-content": "Publish Content",
  "practice-skill": "Practice Skill",
  "review-work": "Review Work",
  "connect-with": "Connect With",
};

const taskTypeDescriptions: Record<TaskTypeSlug, string> = {
  "read-text": "Read articles, posts, or documents",
  "watch-video": "Watch instructional videos",
  "take-quiz": "Complete assessment quizzes",
  "follow-guide": "Follow step-by-step guides",
  "scavenger-hunt": "Find and collect items or information",
  "read-quote": "Read and reflect on quotes",
  "create-content": "Create new content pieces",
  "refine-content": "Improve existing content",
  "publish-content": "Publish content to platforms",
  "practice-skill": "Practice specific skills",
  "review-work": "Review and provide feedback",
  "connect-with": "Connect with people or communities",
};

export function TaskTypeSelector({
  selectedSlug,
  onSelect,
  disabled = false,
}: TaskTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {TASK_TYPE_SLUGS.map((slug) => {
        const isSelected = selectedSlug === slug;
        return (
          <button
            key={slug}
            type="button"
            onClick={() => !disabled && onSelect(slug)}
            disabled={disabled}
            className={`flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            } ${
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            <span className="font-medium text-sm">{taskTypeDisplayNames[slug]}</span>
            <span className="text-xs text-muted-foreground">
              {taskTypeDescriptions[slug]}
            </span>
          </button>
        );
      })}
    </div>
  );
}



