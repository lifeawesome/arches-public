"use client";

import { Share2 } from "lucide-react";

/**
 * Opens Share-to-Circle; parent owns modal state and passes onClick.
 */
export function ShareToCircleTrigger({
  onClick,
  disabled,
  label = "Share to Circle",
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 " +
        className
      }
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
