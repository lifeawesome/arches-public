/**
 * Circle @mentions: extract handles from markdown/plain text and rewrite to profile links.
 * Handles must match profiles.username (3–30 chars, [a-zA-Z0-9_]).
 */

const HANDLE_RE = /@([a-zA-Z0-9_]{3,30})\b/g;

export function extractMentionHandles(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(HANDLE_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const h = m[1];
    if (!seen.has(h.toLowerCase())) {
      seen.add(h.toLowerCase());
      out.push(h);
    }
  }
  return out;
}

export type MentionRewritePair = { username: string; userId: string };

/**
 * Replace each @username (resolved) with a markdown link to the member profile.
 */
export function rewriteMentionLinksInMarkdown(
  text: string,
  pairs: MentionRewritePair[]
): string {
  if (pairs.length === 0) return text;
  const byLower = new Map(pairs.map((p) => [p.username.toLowerCase(), p]));
  return text.replace(HANDLE_RE, (full, uname: string) => {
    const p = byLower.get(uname.toLowerCase());
    if (!p) return full;
    return `[@${p.username}](/members/${p.userId})`;
  });
}
