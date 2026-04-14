import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/circles/search/analytics
 * Logs search events (query, filters, result_count) and optional click-through.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = (await request.json().catch(() => ({}))) as {
      query_text?: string;
      filters?: Record<string, unknown>;
      result_count?: number;
      clicked_circle_id?: string | null;
    };

    const payload = {
      user_id: user?.id ?? null,
      query_text: body.query_text?.trim() || null,
      filters: body.filters ?? {},
      result_count: typeof body.result_count === "number" ? body.result_count : null,
      clicked_circle_id: body.clicked_circle_id ?? null,
    };

    const { error } = await supabase.from("circle_search_events").insert(payload);
    if (error) {
      console.error("Error inserting circle_search_events:", error);
      return NextResponse.json({ error: "Failed to log analytics" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/circles/search/analytics:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

