import React from "react";
import type { CirclePollResultRow } from "@/types/circles";

export function PollResultsBars({
  options,
  results,
  selectedIndex,
}: {
  options: string[];
  results: CirclePollResultRow[];
  selectedIndex: number | null;
}) {
  const counts = new Array(options.length).fill(0) as number[];
  for (const r of results) {
    if (r.option_index >= 0 && r.option_index < counts.length) {
      counts[r.option_index] = r.vote_count;
    }
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);

  return (
    <div className="space-y-2">
      {options.map((label, idx) => {
        const count = counts[idx] ?? 0;
        const pct = total === 0 ? 0 : Math.round((count / total) * 100);
        const widthPct = Math.round((count / max) * 100);
        const isSelected = selectedIndex === idx;
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={isSelected ? "font-semibold" : ""}>{label}</span>
                {isSelected && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Your vote
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {count} ({pct}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary/80"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-1 text-xs text-muted-foreground">{total} votes</div>
    </div>
  );
}

