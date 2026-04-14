export const REPORT_REASON_VALUES = [
  "spam",
  "harassment",
  "inappropriate_content",
  "copyright",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASON_VALUES)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  copyright: "Copyright",
  other: "Other",
};

export function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === "string" &&
    (REPORT_REASON_VALUES as readonly string[]).includes(value)
  );
}

/** Max length for optional report description (API + storage). */
export const MAX_REPORT_DESCRIPTION_LENGTH = 4000;

export type ParsedReportDescription =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/** Trim, optional empty → null, enforce max length. */
export function parseReportDescription(input: unknown): ParsedReportDescription {
  if (input === undefined || input === null) {
    return { ok: true, value: null };
  }
  if (typeof input !== "string") {
    return { ok: false, error: "Invalid description" };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > MAX_REPORT_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be at most ${MAX_REPORT_DESCRIPTION_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed };
}
