const MARKDOWN_MAX_LENGTH = 20_000;

function collapseLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function normalizeMarkdownInput(value: unknown): string {
  const stringValue = typeof value === "string" ? value : String(value ?? "");
  return collapseLineEndings(stringValue).trim();
}

export function hasRenderableMarkdownContent(value: string): boolean {
  // Treat image-only markdown as valid content for media-first posts.
  if (/!\[[^\]]*]\([^)]*\)/.test(value)) {
    return true;
  }
  const withoutCodeFences = value.replace(/```[\s\S]*?```/g, " ");
  const withoutInlineCode = withoutCodeFences.replace(/`[^`]*`/g, " ");
  const withoutImages = withoutInlineCode.replace(/!\[[^\]]*]\([^)]*\)/g, " ");
  const withoutLinks = withoutImages.replace(/\[([^\]]+)]\([^)]*\)/g, "$1");
  const withoutFormatting = withoutLinks.replace(/[*_~>#|`-]/g, " ");
  const normalized = withoutFormatting.replace(/\s+/g, " ").trim();
  return normalized.length > 0;
}

export function enforceMarkdownLength(value: string, max = MARKDOWN_MAX_LENGTH): string | null {
  if (value.length > max) {
    return `Markdown content exceeds ${max} characters`;
  }
  return null;
}

function isAllowedAbsoluteUrl(url: URL, allowMailToTel: boolean): boolean {
  if (url.protocol === "http:" || url.protocol === "https:") return true;
  if (allowMailToTel && (url.protocol === "mailto:" || url.protocol === "tel:")) return true;
  return false;
}

export function sanitizeMarkdownUrl(rawUrl: string | null | undefined, allowMailToTel = false): string {
  const value = (rawUrl ?? "").trim();
  if (!value) return "";

  if (value.startsWith("#") || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return isAllowedAbsoluteUrl(parsed, allowMailToTel) ? value : "";
  } catch {
    return "";
  }
}

export const markdownLimits = {
  maxLength: MARKDOWN_MAX_LENGTH,
};
