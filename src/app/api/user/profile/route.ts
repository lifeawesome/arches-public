import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * GET /api/user/profile — current user's profile id, username, full_name.
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("[user/profile] GET:", error);
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("GET /api/user/profile:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile — update username (for @mentions).
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { username?: string | null };
    const raw = body.username;
    if (raw === undefined) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    const trimmed = typeof raw === "string" ? raw.trim() : "";
    const username = trimmed === "" ? null : trimmed;

    if (username !== null && !USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–30 characters: letters, numbers, and underscores only." },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update({ username })
      .eq("id", user.id)
      .select("id, username, full_name, avatar_url")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
      console.error("[user/profile] PATCH:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: updated });
  } catch (err) {
    console.error("PATCH /api/user/profile:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
