const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const exactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function safeInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

/** Short label for UI (e.g. 1.2k, 5.3M). */
export function formatCompactNumber(n: number): string {
  return compactFormatter.format(safeInt(n));
}

/** Full count for tooltips and aria (e.g. 12,345). */
export function formatExactCount(n: number): string {
  return exactFormatter.format(safeInt(n));
}
