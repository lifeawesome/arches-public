import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchLinkPreview } from "@/lib/utils/link-preview";

/**
 * GET /api/link-preview?url=
 * Authenticated. SSRF-hardened Open Graph / title preview for Share-to-Circle.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const urlParam = request.nextUrl.searchParams.get("url");
    if (!urlParam?.trim()) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const preview = await fetchLinkPreview(urlParam);
    return NextResponse.json({ preview });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
