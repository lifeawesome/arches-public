/**
 * Posts for a circle — the usual `circle_content` rows where `content_type` is `'post'`.
 *
 * README dropped you here: welcome. GET is the chill path — we check you can see the circle,
 * then we only ask the database for posts that are approved, published, and not hiding in the
 * deleted pile. RLS still gets a vote, so think of our filters as "what we meant to show," not
 * the whole security story.
 * POST is where the conveyor belt lives: are you logged in, may you post, have you nodded at
 * the guidelines (drafts get a pass), is the markdown sane, are we drafting/scheduling/shipping,
 * does moderation want this live today, mentions maybe need the service-role fairy, then insert.
 * We only ping `notify_circle_members_of_new_post` when the post is actually out in the world —
 * pending moderation means "content is pending approval." This is shared with the `content/share`
 * route: `src/app/api/circles/[id]/content/share/route.ts` for sharing content from other sources.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  canAccessCircle,
  canCreateCirclePost,
  getGuidelinesAckRequirement,
  resolveInitialApprovalStatus,
} from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";
import {
  enforceMarkdownLength,
  hasRenderableMarkdownContent,
  markdownLimits,
  normalizeMarkdownInput,
} from "@/lib/utils/markdown";
import type {
  CircleContentApprovalStatus,
  CircleContentPublicationStatus,
  CircleContentWithAuthor,
  CircleContentType,
} from "@/types/circles";
import { extractMentionHandles } from "@/lib/circles/mentions";
import {
  applyMentionsAfterContentSave,
  validateCircleMentionText,
} from "@/lib/circles/mention-sync";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

type PostComposeMode = "publish" | "draft" | "schedule";

function parsePostMode(raw: unknown): PostComposeMode {
  if (raw === "draft" || raw === "schedule") return raw;
  return "publish";
}

/**
 * GET /api/circles/[id]/posts
 * List published posts (circle_content with content_type = 'post') for a circle.
 * Only approved, non-deleted posts are returned; RLS further restricts visibility.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(
      parseInt(searchParams.get("page") || "1", 10) || 1,
      1,
    );
    const perPageRaw =
      parseInt(searchParams.get("per_page") || String(DEFAULT_PER_PAGE), 10) ||
      DEFAULT_PER_PAGE;
    const perPage = Math.min(Math.max(perPageRaw, 1), MAX_PER_PAGE);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const canAccess = await canAccessCircle(circleId, user?.id ?? null);
    if (!canAccess) {
      return jsonCircleAccessForbidden(circleId, user?.id);
    }

    const baseQuery = supabase
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
        publication_status,
        scheduled_for,
        published_at,
        created_at,
        updated_at,
        shared_from,
        shared_by
      `,
        { count: "exact" },
      )
      .eq("circle_id", circleId)
      .eq("content_type", "post" as CircleContentType)
      .eq("approval_status", "approved")
      .eq("publication_status", "published")
      .eq("is_welcome_post", false)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("created_at", { ascending: false })
      .range(from, to);

    // RLS will handle whether the current user (or anon) can see rows.
    const { data, error, count } = await baseQuery;
    if (error) {
      console.error("Error fetching circle posts:", error);
      return NextResponse.json(
        { error: "Failed to load posts" },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      circle_id: string;
      author_id: string;
      title: string;
      content: string;
      content_type: string;
      is_free: boolean;
      is_published: boolean;
      is_pinned: boolean;
      approval_status: string;
      approved_by: string | null;
      approved_at: string | null;
      rejection_reason: string | null;
      view_count: number;
      like_count: number;
      downvote_count?: number;
      comment_count: number;
      publication_status?: CircleContentPublicationStatus;
      scheduled_for?: string | null;
      published_at: string | null;
      created_at: string;
      updated_at: string;
      shared_from: unknown | null;
      shared_by: string | null;
    }>;

    const profileIds = new Set<string>();
    for (const r of rows) {
      profileIds.add(r.author_id);
      if (r.shared_by) profileIds.add(r.shared_by);
    }
    const plist = [...profileIds];
    let profileMap = new Map<
      string,
      { full_name: string; avatar_url: string | null }
    >();
    if (plist.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", plist);
      profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          { full_name: p.full_name ?? "", avatar_url: p.avatar_url ?? null },
        ]),
      );
    }

    const posts: CircleContentWithAuthor[] = rows.map((r) => {
      const authorP = profileMap.get(r.author_id);
      const sharerP = r.shared_by ? profileMap.get(r.shared_by) : null;
      return {
        id: r.id,
        circle_id: r.circle_id,
        author_id: r.author_id,
        title: r.title,
        content: r.content,
        content_type: r.content_type as CircleContentType,
        is_free: r.is_free,
        is_published: r.is_published,
        is_pinned: r.is_pinned,
        approval_status: r.approval_status as CircleContentApprovalStatus,
        approved_by: r.approved_by,
        approved_at: r.approved_at,
        rejection_reason: r.rejection_reason,
        view_count: r.view_count,
        like_count: r.like_count,
        downvote_count: r.downvote_count ?? 0,
        comment_count: r.comment_count,
        publication_status: (r.publication_status ??
          "published") as CircleContentPublicationStatus,
        scheduled_for: r.scheduled_for ?? null,
        published_at: r.published_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        shared_from: r.shared_from as CircleContentWithAuthor["shared_from"],
        shared_by: r.shared_by,
        author: {
          id: r.author_id,
          full_name: authorP?.full_name ?? "",
          avatar_url: authorP?.avatar_url ?? null,
        },
        sharer: r.shared_by
          ? {
              id: r.shared_by,
              full_name: sharerP?.full_name ?? "",
              avatar_url: sharerP?.avatar_url ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({
      content: posts,
      total: count ?? posts.length,
      page,
      per_page: perPage,
    });
  } catch (err) {
    console.error("GET /api/circles/[id]/posts:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/circles/[id]/posts
 * Create a new post in a circle (content_type = 'post').
 * Auth required; uses circle settings and membership to determine if posting is allowed.
 *
 * Yes, the order of checks matters — shuffling them is how you accidentally email the whole
 * circle about a draft that never should have left the building. Permission first, guidelines
 * next (unless it's a draft), then validate the body, then figure out approval/publish flags,
 * then save, then notify only when we're truly public-ready.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("id, settings")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const canPost = await canCreateCirclePost(circleId, user.id);
    if (!canPost) {
      return NextResponse.json(
        { error: "You are not allowed to post in this circle" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      title?: string;
      content: string;
      is_free?: boolean;
      mode?: string;
      scheduled_for?: string;
    };
    const mode = parsePostMode(body.mode);
    if (mode !== "draft") {
      const ackState = await getGuidelinesAckRequirement(circleId, user.id);
      if (ackState.required && !ackState.acknowledged) {
        return NextResponse.json(
          {
            error:
              "Please acknowledge the latest circle guidelines before posting.",
            code: "guidelines_ack_required",
          },
          { status: 403 },
        );
      }
    }

    const rawTitle = body.title ?? "";
    const title = rawTitle.trim();
    let content = normalizeMarkdownInput(body.content);

    if (mode === "draft") {
      if (!content.trim()) {
        content = "(Empty draft)";
      }
    } else if (!content || !hasRenderableMarkdownContent(content)) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const lengthError = enforceMarkdownLength(
      content,
      markdownLimits.maxLength,
    );
    if (lengthError) {
      return NextResponse.json({ error: lengthError }, { status: 400 });
    }

    if (mode === "schedule") {
      if (!body.scheduled_for) {
        return NextResponse.json(
          { error: "scheduled_for is required for scheduled posts" },
          { status: 400 },
        );
      }
      const scheduledAt = new Date(body.scheduled_for);
      if (Number.isNaN(scheduledAt.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduled_for" },
          { status: 400 },
        );
      }
      if (scheduledAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "scheduled_for must be in the future" },
          { status: 400 },
        );
      }
    }

    // Title is required by DB schema; if the client omits it, use a fallback.
    const effectiveTitle = title || (mode === "draft" ? "Draft" : "Post");

    let publication_status: CircleContentPublicationStatus;
    let scheduled_for: string | null = null;
    let approvalStatus: CircleContentApprovalStatus;
    let isPublished: boolean;

    if (mode === "draft") {
      publication_status = "draft";
      approvalStatus = "approved";
      isPublished = false;
    } else if (mode === "schedule") {
      publication_status = "scheduled";
      scheduled_for = new Date(body.scheduled_for!).toISOString();
      approvalStatus = "approved";
      isPublished = false;
    } else {
      publication_status = "published";
      approvalStatus = await resolveInitialApprovalStatus(circleId, user.id);
      isPublished = approvalStatus === "approved";
    }

    let contentToStore = content;
    let mentionPairs: { username: string; userId: string }[] | null = null;
    if (mode !== "draft" && extractMentionHandles(content).length > 0) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return NextResponse.json(
          { error: "Mentions are not available (server misconfigured)." },
          { status: 500 },
        );
      }
      const mentionAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        {
          auth: { autoRefreshToken: false, persistSession: false },
        },
      );
      const mentionPrep = await validateCircleMentionText({
        admin: mentionAdmin,
        circleId,
        text: content,
        authorId: user.id,
      });
      if (!mentionPrep.ok) {
        return NextResponse.json(
          { error: mentionPrep.error },
          { status: mentionPrep.status },
        );
      }
      contentToStore = mentionPrep.rewrittenText;
      mentionPairs = mentionPrep.pairs;
    }

    const nowIso = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("circle_content")
      .insert({
        circle_id: circleId,
        author_id: user.id,
        title: effectiveTitle,
        content: contentToStore,
        content_type: "post",
        is_free: body.is_free ?? false,
        is_published: isPublished,
        approval_status: approvalStatus,
        publication_status,
        scheduled_for,
        published_at: isPublished ? nowIso : null,
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
        downvote_count,
        comment_count,
        publication_status,
        scheduled_for,
        published_at,
        created_at,
        updated_at,
        shared_from,
        shared_by
      `,
      )
      .single();

    if (error || !inserted) {
      console.error("Error creating circle post:", error);
      return NextResponse.json(
        { error: "Failed to create post" },
        { status: 500 },
      );
    }

    const postId = (inserted as { id: string }).id;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (
      mode !== "draft" &&
      serviceKey &&
      mentionPairs &&
      mentionPairs.length > 0
    ) {
      const mentionAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        {
          auth: { autoRefreshToken: false, persistSession: false },
        },
      );
      const applyErr = await applyMentionsAfterContentSave({
        admin: mentionAdmin,
        circleId,
        contentId: postId,
        commentId: null,
        authorId: user.id,
        pairs: mentionPairs,
      });
      if (applyErr.error) {
        console.error("[posts] mentions:", applyErr.error);
      }
    }

    // Only fan out member notifications when the post is immediately approved and published
    if (isPublished && publication_status === "published") {
      if (!serviceKey) {
        console.error(
          "[posts] Missing SUPABASE_SERVICE_ROLE_KEY for post notifications",
        );
      } else {
        const adminDb = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceKey,
          {
            auth: { autoRefreshToken: false, persistSession: false },
          },
        );

        const { error: rpcError } = await adminDb.rpc(
          "notify_circle_members_of_new_post",
          {
            p_content_id: postId,
          },
        );

        if (rpcError) {
          console.error(
            "[posts] RPC failed:",
            rpcError.message,
            rpcError.details,
            rpcError.hint,
          );
        } else {
          console.log("[posts] RPC succeeded for content_id:", postId);
        }
      }
    }

    const r = inserted as unknown as {
      id: string;
      circle_id: string;
      author_id: string;
      title: string;
      content: string;
      content_type: string;
      is_free: boolean;
      is_published: boolean;
      is_pinned: boolean;
      approval_status: string;
      approved_by: string | null;
      approved_at: string | null;
      rejection_reason: string | null;
      view_count: number;
      like_count: number;
      downvote_count?: number;
      comment_count: number;
      publication_status?: string;
      scheduled_for?: string | null;
      published_at: string | null;
      created_at: string;
      updated_at: string;
      shared_from: unknown | null;
      shared_by: string | null;
    };

    const post: CircleContentWithAuthor = {
      id: r.id,
      circle_id: r.circle_id,
      author_id: r.author_id,
      title: r.title,
      content: r.content,
      content_type: r.content_type as CircleContentType,
      is_free: r.is_free,
      is_published: r.is_published,
      is_pinned: r.is_pinned,
      approval_status: r.approval_status as CircleContentApprovalStatus,
      approved_by: r.approved_by,
      approved_at: r.approved_at,
      rejection_reason: r.rejection_reason,
      view_count: r.view_count,
      like_count: r.like_count,
      downvote_count: r.downvote_count ?? 0,
      comment_count: r.comment_count,
      publication_status: (r.publication_status ??
        "published") as CircleContentPublicationStatus,
      scheduled_for: r.scheduled_for ?? null,
      published_at: r.published_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      shared_from: r.shared_from as CircleContentWithAuthor["shared_from"],
      shared_by: r.shared_by,
      author: {
        id: r.author_id,
        full_name: "",
        avatar_url: null,
      },
      sharer: null,
    };

    return NextResponse.json(
      {
        post,
        pending: approvalStatus === "pending",
        mode,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/circles/[id]/posts:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 },
    );
  }
}
