import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { processDueScheduledPosts } from "@/lib/circles/process-due-scheduled-posts";

/**
 * Publishes due scheduled circle posts (content_type = post) across all circles.
 * Secured with Authorization: Bearer CRON_SECRET.
 * Schedule this route every minute in production (e.g. Vercel Cron, GitHub Actions)
 * if you want app-layer cron in addition to the Supabase pg_cron job.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = verifyCronAuth(request);
    if (!authResult.ok) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          hint:
            authResult.reason === "missing_secret"
              ? "Set CRON_SECRET in the server environment and call with Authorization: Bearer <CRON_SECRET>."
              : "Send Authorization: Bearer <CRON_SECRET>.",
        },
        { status: 401 }
      );
    }

    const { processed } = await processDueScheduledPosts({ circleId: null, limit: 100 });
    return NextResponse.json({ processed });
  } catch (err) {
    console.error("[cron] publish-scheduled-posts:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Vercel Cron and manual checks often use GET. */
export async function GET(request: NextRequest) {
  return POST(request);
}

function verifyCronAuth(request: NextRequest): { ok: true } | { ok: false; reason: "missing_secret" | "bad_token" } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { ok: false, reason: "bad_token" };
  }
  const token = auth.slice("Bearer ".length);
  if (token.length !== secret.length) {
    return { ok: false, reason: "bad_token" };
  }
  try {
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (!timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_token" };
    }
  } catch {
    return { ok: false, reason: "bad_token" };
  }
  return { ok: true };
}
