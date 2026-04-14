import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  canAccessCircle,
  canPinContent,
  canApproveContent,
  canDeleteContent,
  canModerateContent,
} from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";
import type { CircleContentWithAuthor, CircleContentType } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string; contentId: string }> };

/**
 * GET /api/circles/[id]/content/[contentId]
 * Single feed post/poll row (approved, not deleted) when user can access the circle.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const canAccess = await canAccessCircle(circleId, user?.id ?? null);
    if (!canAccess) {
      return jsonCircleAccessForbidden(circleId, user?.id);
    }

    const { data: row, error } = await supabase
      .from("circle_content")
      .select(
        `
        id,
        circle_id,
        author_id,
        title,
        content,
        content_type,
        is_free,
        is_published,
        is_pinned,
        approval_status,
        approved_by,
        approved_at,
        rejection_reason,
        view_count,
        like_count,
        downvote_count,
        comment_count,
        published_at,
        created_at,
        updated_at,
        publication_status,
        scheduled_for,
        shared_from,
        shared_by
      `
      )
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .eq("approval_status", "approved")
      .eq("publication_status", "published")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .maybeSingle();

    if (error) {
      console.error("GET content single:", error);
      return NextResponse.json({ error: "Failed to load content" }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const r = row as Record<string, unknown>;
    const authorId = r.author_id as string;
    const sharedById = (r.shared_by as string | null) ?? null;
    const profileIds = [...new Set([authorId, sharedById].filter(Boolean) as string[])];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", profileIds);

    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const author = pmap.get(authorId) ?? { full_name: "", avatar_url: null };
    const post: CircleContentWithAuthor = {
      ...(r as unknown as CircleContentWithAuthor),
      content_type: r.content_type as CircleContentType,
      author: {
        id: authorId,
        full_name: author.full_name ?? "",
        avatar_url: author.avatar_url ?? null,
      },
      sharer: sharedById
        ? {
            id: sharedById,
            full_name: pmap.get(sharedById)?.full_name ?? "",
            avatar_url: pmap.get(sharedById)?.avatar_url ?? null,
          }
        : null,
    };

    return NextResponse.json({ content: post });
  } catch (err) {
    console.error("GET /api/circles/[id]/content/[contentId]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/circles/[id]/content/[contentId]
 * Moderator/owner only. Allowed updates: is_pinned, is_published.
 * Regular authors may not pin or approve their own content via this endpoint.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { is_pinned?: boolean; is_published?: boolean };
    const { is_pinned, is_published } = body;

    if (is_pinned === undefined && is_published === undefined) {
      return NextResponse.json(
        { error: "Nothing to update; provide is_pinned or is_published" },
        { status: 400 }
      );
    }

    const { data: content, error: fetchError } = await supabase
      .from("circle_content")
      .select("id, circle_id, is_pinned, is_published, is_welcome_post")
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ((content as { is_welcome_post?: boolean }).is_welcome_post && is_pinned === false) {
      return NextResponse.json({ error: "Welcome post must remain pinned" }, { status: 400 });
    }

    if (is_pinned !== undefined) {
      const canPin = await canPinContent(contentId, user.id);
      if (!canPin) {
        return NextResponse.json(
          { error: "Only moderators and owners can pin content" },
          { status: 403 }
        );
      }
      updates.is_pinned = is_pinned;
      void supabase.from("circle_moderation_activity_log").insert({
        circle_id: circleId,
        actor_id: user.id,
        action: is_pinned ? "content_pinned" : "content_unpinned",
        target_type: "content",
        target_id: contentId,
        metadata: {},
      });
    }

    if (is_published !== undefined) {
      const canApprove = await canApproveContent(contentId, user.id);
      if (!canApprove) {
        return NextResponse.json(
          { error: "Only moderators and owners can approve or unpublish content" },
          { status: 403 }
        );
      }
      updates.is_published = is_published;
      // Keep approval_status in sync with is_published for backwards compatibility
      updates.approval_status = is_published ? "approved" : "pending";
      if (is_published && !(content as { is_published: boolean }).is_published) {
        updates.published_at = new Date().toISOString();
        updates.approved_by = user.id;
        updates.approved_at = new Date().toISOString();
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("circle_content")
      .update(updates)
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating content:", updateError);
      return NextResponse.json(
        { error: "Failed to update content", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ content: updated });
  } catch (err) {
    console.error("PATCH /api/circles/[id]/content/[contentId]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/circles/[id]/content/[contentId]
 * Moderators/owners: soft delete (is_deleted) and log. Authors: hard delete own content.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: content, error: fetchError } = await supabase
      .from("circle_content")
      .select("id, circle_id, author_id, is_welcome_post")
      .eq("id", contentId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }
    if ((content as { is_welcome_post?: boolean }).is_welcome_post) {
      return NextResponse.json(
        { error: "Welcome posts cannot be deleted directly; update the welcome post instead." },
        { status: 400 }
      );
    }

    const allowed = await canDeleteContent(contentId, user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to delete this content" },
        { status: 403 }
      );
    }

    const isModeratorOrOwner = await canModerateContent(
      (content as { circle_id: string }).circle_id,
      user.id
    );

    if (isModeratorOrOwner) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("circle_content")
        .update({
          is_deleted: true,
          deleted_at: now,
          deleted_by: user.id,
          updated_at: now,
        })
        .eq("id", contentId)
        .eq("circle_id", circleId);

      if (updateError) {
        console.error("Error soft-deleting content:", updateError);
        return NextResponse.json(
          { error: "Failed to delete content", details: updateError.message },
          { status: 500 }
        );
      }

      await supabase.from("circle_moderation_activity_log").insert({
        circle_id: circleId,
        actor_id: user.id,
        action: "content_soft_deleted",
        target_type: "content",
        target_id: contentId,
        metadata: {},
      });
    } else {
      const { error: deleteError } = await supabase
        .from("circle_content")
        .delete()
        .eq("id", contentId)
        .eq("circle_id", circleId);

      if (deleteError) {
        console.error("Error deleting content:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete content", details: deleteError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/circles/[id]/content/[contentId]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
