import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/circles/my-drafts-count
 * Returns how many draft posts the current user has across all circles (for dashboard).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { count, error } = await supabase
      .from("circle_content")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .eq("content_type", "post")
      .eq("publication_status", "draft");

    if (error) {
      console.error("my-drafts-count:", error);
      return NextResponse.json({ error: "Failed to load count" }, { status: 500 });
    }

    return NextResponse.json({ draft_count: count ?? 0 });
  } catch (err) {
    console.error("GET /api/circles/my-drafts-count:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
