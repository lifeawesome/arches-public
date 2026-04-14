/**
 * Share something into a circle — you get a real post row, just with `shared_from` / `shared_by`
 * filled in so the UI can tell a remix from an original.
 *
 * Two different "may I?" questions: can you see the circle (`canAccessCircle`), and are you
 * allowed to share into it (`canShareToCircle`)? Circles can absolutely say "posting is mod-only
 * but sharing is for everyone," so peek at access-control before you collapse those into one check.
 * Internal shares: prove you can view the source, then we nitpick — posts only, approved, published,
 * not deleted. URLs: we stitch markdown and maybe fetch a preview; the internet is weird, we try.
 * Mentions, approval, and the notify RPC intentionally rhyme with the posts route — if one learns
 * a new trick, consider teaching the other so users don't get whiplash.
 * `circle_content_share_events` is the diary for analytics; if it fails, the share still happened.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  canAccessCircle,
  canShareToCircle,
  canViewContent,
  getGuidelinesAckRequirement,
  resolveInitialApprovalStatus,
} from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";
import { fetchLinkPreview } from "@/lib/utils/link-preview";
import type {
  CircleContentApprovalStatus,
  CircleContentWithAuthor,
  CircleContentType,
  LinkPreviewSnapshot,
  SharedFromCircleContent,
  SharedFromUrl,
} from "@/types/circles";
import { extractMentionHandles } from "@/lib/circles/mentions";
import { applyMentionsAfterContentSave, validateCircleMentionText } from "@/lib/circles/mention-sync";

type RouteParams = { params: Promise<{ id: string }> };

type ShareSourceBody =
  | { kind: "circle_content"; content_id: string }
  | { kind: "url"; url: string; preview?: LinkPreviewSnapshot };

/**
 * POST /api/circles/[id]/content/share
 * Create a post row with shared_from / shared_by (internal post or external URL).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: targetCircleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await canAccessCircle(targetCircleId, user.id);
    if (!canAccess) {
      return jsonCircleAccessForbidden(targetCircleId, user.id);
    }

    const canShare = await canShareToCircle(targetCircleId, user.id);
    if (!canShare) {
      return NextResponse.json({ error: "You are not allowed to share into this circle" }, { status: 403 });
    }
    const ackState = await getGuidelinesAckRequirement(targetCircleId, user.id);
    if (ackState.required && !ackState.acknowledged) {
      return NextResponse.json(
        { error: "Please acknowledge the latest circle guidelines before posting.", code: "guidelines_ack_required" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      source?: ShareSourceBody;
      comment?: string;
      title?: string;
    };

    const source = body.source;
    if (!source || !source.kind) {
      return NextResponse.json({ error: "source is required" }, { status: 400 });
    }

    const comment = (body.comment ?? "").trim();
    let title: string;
    let content: string;
    let sharedFrom: SharedFromCircleContent | SharedFromUrl;

    if (source.kind === "circle_content") {
      const contentId = source.content_id?.trim();
      if (!contentId) {
        return NextResponse.json({ error: "content_id is required" }, { status: 400 });
      }

      const canSee = await canViewContent(contentId, user.id);
      if (!canSee) {
        return NextResponse.json({ error: "You cannot access that content" }, { status: 403 });
      }

      const { data: src, error: srcErr } = await supabase
        .from("circle_content")
        .select(
          "id, title, content, content_type, circle_id, approval_status, is_deleted, is_published"
        )
        .eq("id", contentId)
        .single();

      if (srcErr || !src) {
        return NextResponse.json({ error: "Source content not found" }, { status: 404 });
      }

      const row = src as {
        id: string;
        title: string;
        content: string;
        content_type: string;
        circle_id: string;
        approval_status: string;
        is_deleted: boolean | null;
        is_published: boolean;
      };

      if (row.content_type !== "post") {
        return NextResponse.json({ error: "Only posts can be shared" }, { status: 400 });
      }
      if (row.approval_status !== "approved" || !row.is_published) {
        return NextResponse.json({ error: "Source is not available to share" }, { status: 400 });
      }
      if (row.is_deleted) {
        return NextResponse.json({ error: "Source content was removed" }, { status: 400 });
      }

      const { data: srcCircle } = await supabase
        .from("circles")
        .select("slug, name")
        .eq("id", row.circle_id)
        .single();

      sharedFrom = {
        kind: "circle_content",
        content_id: row.id,
        circle_id: row.circle_id,
        circle_slug: (srcCircle as { slug?: string } | null)?.slug,
        circle_name: (srcCircle as { name?: string } | null)?.name,
        title_snapshot: row.title,
      };

      title = body.title?.trim() || `Shared: ${row.title}`.slice(0, 500);
      const parts: string[] = [];
      if (comment) parts.push(comment, "");
      parts.push(`_Shared from a circle post._`, "", row.content);
      content = parts.join("\n").trim();
    } else {
      const rawUrl = source.url?.trim();
      if (!rawUrl) {
        return NextResponse.json({ error: "url is required" }, { status: 400 });
      }

      let preview: LinkPreviewSnapshot | undefined = source.preview;
      if (!preview?.title && !preview?.description) {
        try {
          const fetched = await fetchLinkPreview(rawUrl);
          preview = {
            title: fetched.title,
            description: fetched.description,
            image: fetched.image,
            site_name: fetched.site_name,
          };
        } catch {
          preview = preview ?? {};
        }
      }

      sharedFrom = {
        kind: "url",
        url: rawUrl,
        preview,
      };

      const host = (() => {
        try {
          return new URL(rawUrl).hostname;
        } catch {
          return "link";
        }
      })();

      title =
        body.title?.trim() ||
        (preview?.title ? preview.title.slice(0, 500) : `Link: ${host}`).slice(0, 500);

      const parts: string[] = [];
      if (comment) parts.push(comment, "");
      parts.push(`[Open link](${rawUrl})`);
      if (preview?.description) {
        parts.push("", preview.description);
      }
      content = parts.join("\n").trim();
    }

    if (!content) {
      return NextResponse.json({ error: "Content could not be built" }, { status: 400 });
    }

    let contentToStore = content;
    let mentionPairs: { username: string; userId: string }[] | null = null;
    if (extractMentionHandles(content).length > 0) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return NextResponse.json(
          { error: "Mentions are not available (server misconfigured)." },
          { status: 500 }
        );
      }
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const mentionPrep = await validateCircleMentionText({
        admin: mentionAdmin,
        circleId: targetCircleId,
        text: content,
        authorId: user.id,
      });
      if (!mentionPrep.ok) {
        return NextResponse.json({ error: mentionPrep.error }, { status: mentionPrep.status });
      }
      contentToStore = mentionPrep.rewrittenText;
      mentionPairs = mentionPrep.pairs;
    }

    const approvalStatus: CircleContentApprovalStatus = await resolveInitialApprovalStatus(
      targetCircleId,
      user.id
    );
    const isPublished = approvalStatus === "approved";
    const shareNowIso = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from("circle_content")
      .insert({
        circle_id: targetCircleId,
        author_id: user.id,
        title,
        content: contentToStore,
        content_type: "post" as CircleContentType,
        is_free: false,
        is_published: isPublished,
        approval_status: approvalStatus,
        publication_status: "published",
        scheduled_for: null,
        published_at: isPublished ? shareNowIso : null,
        shared_from: sharedFrom as unknown as Record<string, unknown>,
        shared_by: user.id,
      })
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
        comment_count,
        published_at,
        created_at,
        updated_at,
        shared_from,
        shared_by
      `
      )
      .single();

    if (insertError || !inserted) {
      console.error("share insert:", insertError);
      return NextResponse.json({ error: "Failed to create share" }, { status: 500 });
    }

    const postId = (inserted as { id: string }).id;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && mentionPairs && mentionPairs.length > 0) {
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const applyErr = await applyMentionsAfterContentSave({
        admin: mentionAdmin,
        circleId: targetCircleId,
        contentId: postId,
        commentId: null,
        authorId: user.id,
        pairs: mentionPairs,
      });
      if (applyErr.error) {
        console.error("[share] mentions:", applyErr.error);
      }
    }

    void supabase.from("circle_content_share_events").insert({
      user_id: user.id,
      target_circle_id: targetCircleId,
      new_content_id: postId,
      shared_from: sharedFrom as unknown as Record<string, unknown>,
    });

    if (isPublished) {
      if (!serviceKey) {
        console.error("[share] Missing SUPABASE_SERVICE_ROLE_KEY");
      } else {
        const adminDb = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { error: rpcError } = await adminDb.rpc("notify_circle_members_of_new_post", {
          p_content_id: postId,
        });

        if (rpcError) {
          console.error("[share] notify RPC:", rpcError.message);
        }
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .single();

    const r = inserted as unknown as CircleContentWithAuthor;
    r.author = {
      id: user.id,
      full_name: (profile as { full_name?: string } | null)?.full_name ?? "",
      avatar_url: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    };
    r.sharer = r.author;

    return NextResponse.json({
      post: r,
      pending: approvalStatus === "pending",
    });
  } catch (err) {
    console.error("POST /api/circles/[id]/content/share:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
