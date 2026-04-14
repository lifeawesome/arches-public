"use client";

import Link from "next/link";
import { CheckCircle2, Lock, Circle, Clock } from "lucide-react";
import type { Task } from "@/lib/admin/level-task-queries";
import type { TaskStatus } from "@/lib/pathways/progress";

interface TaskNodeProps {
  task: Task;
  status: TaskStatus;
  isKeystone?: boolean;
  onClick?: () => void;
}

export default function TaskNode({
  task,
  status,
  isKeystone = false,
  onClick,
}: TaskNodeProps) {
  const baseClasses =
    "relative flex items-start gap-4 rounded-lg border-2 p-4 transition-all";
  
  const statusClasses = {
    past: "border-muted bg-muted/30 opacity-60",
    current: "border-primary bg-primary/5 shadow-lg shadow-primary/20",
    next: "border-muted bg-muted/50 opacity-75",
    locked: "border-muted bg-muted/20 opacity-50 cursor-not-allowed",
  };

  const iconClasses = {
    past: "text-primary",
    current: "text-primary",
    next: "text-muted-foreground",
    locked: "text-muted-foreground",
  };

  const Icon = {
    past: CheckCircle2,
    current: Circle,
    next: Circle,
    locked: Lock,
  }[status];

  const isClickable = status === "past" || status === "current";

  const content = (
    <div className={`${baseClasses} ${statusClasses[status]}`}>
      <div className={`mt-0.5 shrink-0 ${iconClasses[status]}`}>
        <Icon className="h-5 w-5" fill={status === "past" ? "currentColor" : "none"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`font-semibold ${
              status === "current"
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {task.title}
            {isKeystone && (
              <span className="ml-2 text-xs text-primary">⭐</span>
            )}
          </h4>
          {status === "current" && (
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Current
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {task.objective}
        </p>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {task.time_min}-{task.time_max} min
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">{task.xp_value} XP</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isClickable) {
    return <div>{content}</div>;
  }

  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  // Default: link to action page
  return (
    <Link href={`/dashboard/action?task=${task.id}`} className="block">
      {content}
    </Link>
  );
}



