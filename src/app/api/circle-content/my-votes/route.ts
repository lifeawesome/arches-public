import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { internalServerError } from "@/lib/utils/api-public-error";
import { parseUuidIdArray } from "@/lib/utils/circles/vote-api";
import { checkVoteBatchRateLimit } from "@/lib/utils/circles/vote-rate-limit";

const MAX_IDS = 80;

type VoteDir = "up" | "down";

/**
 * POST /api/circle-content/my-votes
 * Body: { content_ids: string[] } — returns { votes: Record<contentId, "up"|"down"> } for the current user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = checkVoteBatchRateLimit(user.id);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later.", retryAfterSeconds: rate.retryAfterSeconds },
        {
          status: 429,
          headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined,
        }
      );
    }

    let body: { content_ids?: unknown };
    try {
      body = (await request.json()) as { content_ids?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseUuidIdArray(body.content_ids, MAX_IDS);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const content_ids = parsed.ids;

    if (content_ids.length === 0) {
      return NextResponse.json({ votes: {} as Record<string, VoteDir> });
    }

    const { data: rows, error } = await supabase
      .from("circle_content_votes")
      .select("content_id, vote_type")
      .eq("user_id", user.id)
      .in("content_id", content_ids);

    if (error) {
      console.error("my-votes:", error);
      return internalServerError("POST /api/circle-content/my-votes", error, "Failed to load votes");
    }

    const votes: Record<string, VoteDir> = {};
    for (const r of rows ?? []) {
      const row = r as { content_id: string; vote_type: VoteDir };
      if (row.vote_type === "up" || row.vote_type === "down") {
        votes[row.content_id] = row.vote_type;
      }
    }

    return NextResponse.json({ votes });
  } catch (err) {
    return internalServerError("POST /api/circle-content/my-votes:", err);
  }
}
