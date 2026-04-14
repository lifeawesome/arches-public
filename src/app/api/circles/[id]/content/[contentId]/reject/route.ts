import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canApproveContent } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string; contentId: string }> };

/**
 * POST /api/circles/[id]/content/[contentId]/reject
 * Moderator/owner only. Transitions content to rejected (hidden).
 * Body: { rejection_reason?: string }
 * After rejection:
 *   - Sets approval_status='rejected', is_published=false, approved_by, approved_at, rejection_reason.
 *   - Sends in-app notification to the author with the reason.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canApprove = await canApproveContent(contentId, user.id);
    if (!canApprove) {
      return NextResponse.json(
        { error: "Only moderators and owners can reject content" },
        { status: 403 }
      );
    }

    const { data: content, error: fetchError } = await supabase
      .from("circle_content")
      .select("id, circle_id, author_id, title")
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as { rejection_reason?: string };
    const rejectionReason = (body.rejection_reason ?? "").trim() || null;

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("circle_content")
      .update({
        approval_status: "rejected",
        approved_by: user.id,
        approved_at: now,
        rejection_reason: rejectionReason,
        is_published: false,
        updated_at: now,
      })
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error rejecting content:", updateError);
      return NextResponse.json(
        { error: "Failed to reject content", details: updateError.message },
        { status: 500 }
      );
    }

    const adminDb = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authorId = (content as { author_id: string }).author_id;
    const contentTitle = (content as { title: string }).title;
    const reasonSuffix = rejectionReason ? ` Reason: ${rejectionReason}` : "";

    // Notify the author that their post was rejected
    await adminDb.rpc("create_notification_event", {
      p_user_id: authorId,
      p_event_type: "circle_post_rejected",
      p_title: "Your post was not approved",
      p_message: `Your post "${contentTitle}" was not approved by a moderator.${reasonSuffix}`,
      p_metadata: {
        circle_id: circleId,
        content_id: contentId,
        approval_status: "rejected",
        approved_by: user.id,
        rejection_reason: rejectionReason,
        notification_key: `post_rejected_${contentId}`,
      },
      p_action_url: `/circles/${circleId}`,
      p_priority: "normal",
      p_channels: ["in_app"],
    });

    return NextResponse.json({ content: updated });
  } catch (err) {
    console.error("POST /api/circles/[id]/content/[contentId]/reject:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
