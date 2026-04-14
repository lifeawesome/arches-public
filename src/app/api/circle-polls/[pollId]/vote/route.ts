import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type RouteParams = { params: Promise<{ pollId: string }> };

type VoteBody = {
  option_index: number;
};

/**
 * POST /api/circle-polls/[pollId]/vote
 * Upserts the caller's vote (one vote per user per poll).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { pollId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<VoteBody>;
    const optionIndexRaw = body.option_index;
    const option_index = typeof optionIndexRaw === "number" ? optionIndexRaw : parseInt(String(optionIndexRaw), 10);

    if (!Number.isFinite(option_index)) {
      return NextResponse.json({ error: "option_index is required" }, { status: 400 });
    }

    // Upsert vote row (unique constraint poll_id,user_id)
    // RLS + trigger will validate access and option_index bounds.
    const { error: upsertError } = await supabase.from("circle_poll_votes").upsert(
      {
        poll_id: pollId,
        user_id: user.id,
        option_index,
      },
      { onConflict: "poll_id,user_id" }
    );

    if (upsertError) {
      // If user isn't allowed or option_index is invalid, Postgres will error (RLS / trigger).
      const msg = upsertError.message || "Failed to vote";
      const status = msg.toLowerCase().includes("permission") ? 403 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    // Return updated results (aggregated-only)
    const { data: resultsRows, error: resultsError } = await supabase
      .from("circle_poll_results")
      .select("poll_id, option_index, vote_count")
      .eq("poll_id", pollId)
      .order("option_index", { ascending: true });

    if (resultsError) {
      console.error("Error fetching poll results after vote:", resultsError);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json(
      {
        ok: true,
        results: (resultsRows ?? []).map((r) => {
          const row = r as unknown as { option_index: number; vote_count: number };
          return { option_index: row.option_index, vote_count: row.vote_count };
        }),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/circle-polls/[pollId]/vote:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

