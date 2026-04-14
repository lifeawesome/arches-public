import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canApproveContent } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string; contentId: string }> };

/**
 * POST /api/circles/[id]/content/[contentId]/approve
 * Moderator/owner only. Transitions content from pending → approved.
 * After approval:
 *   - Sets approval_status='approved', is_published=true, approved_by, approved_at.
 *   - Sends in-app notification to the author.
 *   - Fans out circle_post_created notification to all members (idempotent).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
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
        { error: "Only moderators and owners can approve content" },
        { status: 403 }
      );
    }

    const { data: content, error: fetchError } = await supabase
      .from("circle_content")
      .select("id, circle_id, author_id, title, approval_status, is_published")
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const wasAlreadyPublished = (content as { is_published: boolean }).is_published;

    const { data: updated, error: updateError } = await supabase
      .from("circle_content")
      .update({
        approval_status: "approved",
        approved_by: user.id,
        approved_at: now,
        rejection_reason: null,
        is_published: true,
        publication_status: "published",
        published_at: wasAlreadyPublished ? undefined : now,
        updated_at: now,
      })
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error approving content:", updateError);
      return NextResponse.json(
        { error: "Failed to approve content", details: updateError.message },
        { status: 500 }
      );
    }

    const adminDb = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authorId = (content as { author_id: string }).author_id;

    // Notify the author that their post was approved
    await adminDb.rpc("create_notification_event", {
      p_user_id: authorId,
      p_event_type: "circle_post_approved",
      p_title: "Your post was approved",
      p_message: `Your post "${(content as { title: string }).title}" has been approved and is now visible in the circle.`,
      p_metadata: {
        circle_id: circleId,
        content_id: contentId,
        approval_status: "approved",
        approved_by: user.id,
        notification_key: `post_approved_${contentId}`,
      },
      p_action_url: `/circles/${circleId}`,
      p_priority: "normal",
      p_channels: ["in_app"],
    });

    // Fan out the new-post notification to circle members (idempotent via notification_key)
    const { error: fanoutError } = await adminDb.rpc("notify_circle_members_of_new_post", {
      p_content_id: contentId,
    });
    if (fanoutError) {
      console.error("[approve] Fanout RPC failed:", fanoutError.message);
    }

    return NextResponse.json({ content: updated });
  } catch (err) {
    console.error("POST /api/circles/[id]/content/[contentId]/approve:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
