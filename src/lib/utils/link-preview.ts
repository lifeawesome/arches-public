import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 512 * 1024;

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (!ip) return true;
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      return isBlockedIpv4(lower.slice(7));
    }
    return false;
  }
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  return true;
}

async function assertHostnameSafe(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("Blocked address");
    return;
  }
  const records = await dns.lookup(hostname, { all: true });
  for (const r of records) {
    if (isBlockedIp(r.address)) throw new Error("Blocked address");
  }
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function pickMeta(html: string, prop: string): string | undefined {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(
    `<meta[^>]+property=["']${esc}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  const m1 = html.match(re1);
  if (m1?.[1]) return decodeBasicEntities(m1[1].trim());
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${esc}["']`,
    "i"
  );
  const m2 = html.match(re2);
  if (m2?.[1]) return decodeBasicEntities(m2[1].trim());
  return undefined;
}

function pickNameMeta(html: string, name: string): string | undefined {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(
    `<meta[^>]+name=["']${esc}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  const m1 = html.match(re1);
  if (m1?.[1]) return decodeBasicEntities(m1[1].trim());
  return undefined;
}

function pickTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (m?.[1]) return decodeBasicEntities(m[1].trim());
  return undefined;
}

export type LinkPreviewResult = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
};

/**
 * Validates URL, resolves DNS (SSRF-hardened), fetches with redirect limit, parses basic OG tags.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }

  if (url.username || url.password) {
    throw new Error("URL must not contain credentials");
  }

  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertHostnameSafe(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent": "ArchesLinkPreview/1.0",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || hop === MAX_REDIRECTS) throw new Error("Too many redirects");
      const next = new URL(loc, current);
      if (next.protocol !== "https:" && next.protocol !== "http:") {
        throw new Error("Invalid redirect protocol");
      }
      current = next;
      continue;
    }

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BODY_BYTES) {
          reader.cancel().catch(() => undefined);
          throw new Error("Response too large");
        }
        chunks.push(value);
      }
    }

    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const html = buf.toString("utf8", 0, Math.min(buf.length, MAX_BODY_BYTES));

    const title =
      pickMeta(html, "og:title") || pickNameMeta(html, "twitter:title") || pickTitle(html);
    const description =
      pickMeta(html, "og:description") || pickNameMeta(html, "description");
    let image = pickMeta(html, "og:image") || pickNameMeta(html, "twitter:image");
    if (image) {
      try {
        image = new URL(image, current).toString();
      } catch {
        image = undefined;
      }
    }
    const site_name = pickMeta(html, "og:site_name");

    return {
      url: current.toString(),
      title,
      description,
      image,
      site_name,
    };
  }

  throw new Error("Too many redirects");
}
