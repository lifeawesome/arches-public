"use client";

import { Eye, MessageSquare, ThumbsUp, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCompactNumber, formatExactCount } from "@/lib/utils/format-compact-number";

export type CircleStatsProps = {
  members: number;
  posts: number;
  views: number;
  upvotes: number;
  variant: "header" | "card";
  className?: string;
};

type Metric = {
  key: string;
  icon: typeof Users;
  label: string;
  value: number;
};

function StatMetric({
  metric,
  variant,
}: {
  metric: Metric;
  variant: "header" | "card";
}) {
  const { icon: Icon, label, value } = metric;
  const compact = formatCompactNumber(value);
  const exact = formatExactCount(value);
  const tooltipText = `${exact} ${label}`;

  const iconClass =
    variant === "header" ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0";
  const textClass =
    variant === "header" ? "text-sm text-muted-foreground" : "text-xs text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-md text-left transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            textClass
          )}
          aria-label={tooltipText}
          onClick={(e) => {
            if (variant === "card") e.stopPropagation();
          }}
        >
          <Icon className={iconClass} aria-hidden />
          <span className="min-w-0">
            <span className="font-medium text-foreground">{compact}</span>{" "}
            <span className="font-normal">{label}</span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

export function CircleStats({ members, posts, views, upvotes, variant, className }: CircleStatsProps) {
  const metrics: Metric[] = [
    { key: "members", icon: Users, label: "members", value: members },
    { key: "posts", icon: MessageSquare, label: "posts", value: posts },
    { key: "views", icon: Eye, label: "views", value: views },
    { key: "upvotes", icon: ThumbsUp, label: "upvotes", value: upvotes },
  ];

  return (
    <div
      className={cn(
        variant === "header" && "mt-6 flex flex-wrap gap-4",
        variant === "card" && "mt-3 flex flex-wrap items-center justify-center gap-2",
        className
      )}
    >
      {metrics.map((m) => (
        <div
          key={m.key}
          className={cn(
            variant === "card" &&
              "inline-flex rounded-full border border-border bg-muted/60 px-2.5 py-1"
          )}
        >
          <StatMetric metric={m} variant={variant} />
        </div>
      ))}
    </div>
  );
}
