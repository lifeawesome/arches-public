import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canAccessCircle, canModerateContent } from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";
import {
  enforceMarkdownLength,
  hasRenderableMarkdownContent,
  markdownLimits,
  normalizeMarkdownInput,
} from "@/lib/utils/markdown";
import { extractMentionHandles } from "@/lib/circles/mentions";
import { applyMentionsAfterContentSave, validateCircleMentionText } from "@/lib/circles/mention-sync";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/welcome
 * Returns active welcome post for the circle (if any), with a legacy settings fallback.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const canAccess = await canAccessCircle(circleId, user.id);
      if (!canAccess) return jsonCircleAccessForbidden(circleId, user.id);
    } else {
      const { data: anonCircle } = await supabase
        .from("circles")
        .select("access_type, visibility, is_active")
        .eq("id", circleId)
        .single();
      const isPublicFree =
        (anonCircle as { access_type?: string; visibility?: string; is_active?: boolean } | null)
          ?.access_type === "free" &&
        (anonCircle as { access_type?: string; visibility?: string; is_active?: boolean } | null)
          ?.visibility === "public" &&
        (anonCircle as { access_type?: string; visibility?: string; is_active?: boolean } | null)
          ?.is_active === true;
      if (!isPublicFree) return jsonCircleAccessForbidden(circleId, null);
    }

    const { data: welcome } = await supabase
      .from("circle_content")
      .select(
        "id,circle_id,author_id,title,content,content_type,is_free,is_published,is_pinned,is_welcome_post,welcome_version,approval_status,approved_by,approved_at,rejection_reason,view_count,like_count,comment_count,published_at,created_at,updated_at"
      )
      .eq("circle_id", circleId)
      .eq("is_welcome_post", true)
      .eq("approval_status", "approved")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (welcome) {
      return NextResponse.json({ welcome_post: welcome, source: "content" });
    }

    const { data: circle } = await supabase
      .from("circles")
      .select("expert_id, settings")
      .eq("id", circleId)
      .single();

    const legacyMarkdown = (circle as { settings?: { guidelines_markdown?: string } } | null)?.settings
      ?.guidelines_markdown;
    if (legacyMarkdown?.trim()) {
      return NextResponse.json({
        welcome_post: {
          id: null,
          circle_id: circleId,
          author_id: (circle as { expert_id?: string })?.expert_id ?? null,
          title: "Welcome",
          content: legacyMarkdown.trim(),
          content_type: "post",
          is_free: true,
          is_published: true,
          is_pinned: true,
          is_welcome_post: true,
          welcome_version: 1,
          approval_status: "approved",
        },
        source: "legacy_settings",
      });
    }

    return NextResponse.json({ welcome_post: null, source: "none" });
  } catch (err) {
    console.error("GET /api/circles/[id]/welcome:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/circles/[id]/welcome
 * Upserts welcome post content. Moderator/owner only.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canModerate = await canModerateContent(circleId, user.id);
    if (!canModerate) {
      return NextResponse.json({ error: "Only moderators and owners can update welcome posts" }, { status: 403 });
    }

    const body = (await request.json()) as { title?: string; content?: string };
    const content = normalizeMarkdownInput(body.content);
    const title = String(body.title ?? "Welcome").trim() || "Welcome";

    if (!content || !hasRenderableMarkdownContent(content)) {
      return NextResponse.json({ error: "Welcome content is required" }, { status: 400 });
    }
    const lengthError = enforceMarkdownLength(content, markdownLimits.maxLength);
    if (lengthError) {
      return NextResponse.json({ error: lengthError }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("circle_content")
      .select("id")
      .eq("circle_id", circleId)
      .eq("is_welcome_post", true)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .maybeSingle();

    if (existing?.id) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return NextResponse.json(
          { error: "Welcome post update requires server configuration." },
          { status: 500 }
        );
      }
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      let contentToStore = content;
      let mentionPairs: { username: string; userId: string }[] = [];
      if (extractMentionHandles(content).length > 0) {
        const mentionPrep = await validateCircleMentionText({
          admin: mentionAdmin,
          circleId,
          text: content,
          authorId: user.id,
        });
        if (!mentionPrep.ok) {
          return NextResponse.json({ error: mentionPrep.error }, { status: mentionPrep.status });
        }
        contentToStore = mentionPrep.rewrittenText;
        mentionPairs = mentionPrep.pairs;
      }

      const { data: updated, error } = await supabase
        .from("circle_content")
        .update({
          title,
          content: contentToStore,
          is_welcome_post: true,
          is_pinned: true,
          is_published: true,
          is_free: true,
          approval_status: "approved",
          publication_status: "published",
          scheduled_for: null,
          published_at: new Date().toISOString(),
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", existing.id)
        .eq("circle_id", circleId)
        .select("*")
        .single();
      if (error) {
        console.error("Error updating welcome post:", error);
        return NextResponse.json({ error: "Failed to update welcome post" }, { status: 500 });
      }

      const applyErr = await applyMentionsAfterContentSave({
        admin: mentionAdmin,
        circleId,
        contentId: existing.id,
        commentId: null,
        authorId: user.id,
        pairs: mentionPairs,
      });
      if (applyErr.error) {
        console.error("[welcome] mentions:", applyErr.error);
      }

      return NextResponse.json({ welcome_post: updated, created: false });
    }

    let contentToStore = content;
    let mentionPairs: { username: string; userId: string }[] | null = null;
    if (extractMentionHandles(content).length > 0) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return NextResponse.json(
          { error: "Welcome post requires server configuration for mentions." },
          { status: 500 }
        );
      }
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const mentionPrep = await validateCircleMentionText({
        admin: mentionAdmin,
        circleId,
        text: content,
        authorId: user.id,
      });
      if (!mentionPrep.ok) {
        return NextResponse.json({ error: mentionPrep.error }, { status: mentionPrep.status });
      }
      contentToStore = mentionPrep.rewrittenText;
      mentionPairs = mentionPrep.pairs;
    }

    const welcomeNow = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("circle_content")
      .insert({
        circle_id: circleId,
        author_id: user.id,
        title,
        content: contentToStore,
        content_type: "post",
        is_free: true,
        is_published: true,
        is_pinned: true,
        is_welcome_post: true,
        approval_status: "approved",
        publication_status: "published",
        scheduled_for: null,
        published_at: welcomeNow,
        approved_by: user.id,
        approved_at: welcomeNow,
      })
      .select("*")
      .single();
    if (error) {
      console.error("Error creating welcome post:", error);
      return NextResponse.json({ error: "Failed to create welcome post" }, { status: 500 });
    }

    const newId = (inserted as { id: string }).id;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && mentionPairs && mentionPairs.length > 0) {
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const applyErr = await applyMentionsAfterContentSave({
        admin: mentionAdmin,
        circleId,
        contentId: newId,
        commentId: null,
        authorId: user.id,
        pairs: mentionPairs,
      });
      if (applyErr.error) {
        console.error("[welcome] mentions:", applyErr.error);
      }
    }

    return NextResponse.json({ welcome_post: inserted, created: true }, { status: 201 });
  } catch (err) {
    console.error("PUT /api/circles/[id]/welcome:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/circles/[id]/welcome
 * Soft-deletes the active welcome post. Moderator/owner only.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canModerate = await canModerateContent(circleId, user.id);
    if (!canModerate) {
      return NextResponse.json({ error: "Only moderators and owners can remove welcome posts" }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from("circle_content")
      .select("id")
      .eq("circle_id", circleId)
      .eq("is_welcome_post", true)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .maybeSingle();

    if (!existing?.id) return NextResponse.json({ removed: false, message: "No welcome post to remove" });

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("circle_content")
      .update({
        is_deleted: true,
        deleted_at: nowIso,
        deleted_by: user.id,
        updated_at: nowIso,
      })
      .eq("id", existing.id)
      .eq("circle_id", circleId);
    if (error) {
      console.error("Error removing welcome post:", error);
      return NextResponse.json({ error: "Failed to remove welcome post" }, { status: 500 });
    }
    return NextResponse.json({ removed: true });
  } catch (err) {
    console.error("DELETE /api/circles/[id]/welcome:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
