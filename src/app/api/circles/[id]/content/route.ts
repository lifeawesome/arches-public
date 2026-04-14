import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canAccessCircle } from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";
import type { CircleContentType } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

type FeedPoll = {
  id: string;
  content_id: string;
  circle_id: string;
  question: string;
  options: string[];
  results: Array<{ option_index: number; vote_count: number }>;
};

type FeedSortMode = "recent" | "top" | "controversial";

type FeedItemBase = {
  id: string;
  circle_id: string;
  author_id: string;
  title: string;
  content: string;
  content_type: CircleContentType;
  is_free: boolean;
  is_published: boolean;
  is_pinned: boolean;
  is_welcome_post?: boolean;
  welcome_version?: number;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  view_count: number;
  like_count: number;
  downvote_count: number;
  comment_count: number;
  publication_status: string;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  shared_from: unknown | null;
  shared_by: string | null;
  author: { id: string; full_name: string; avatar_url: string | null };
  sharer: { id: string; full_name: string; avatar_url: string | null } | null;
};

type FeedItem = FeedItemBase & { poll?: FeedPoll };

function parseOptions(options: unknown): string[] {
  if (!options || typeof options !== "object") return [];
  if (Array.isArray(options)) return options.map((o) => String(o));
  // JSONB from Supabase comes as JS object/array; we only support arrays.
  return [];
}

/**
 * GET /api/circles/[id]/content
 * Mixed feed for a circle (posts + polls). RLS governs visibility.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const perPageRaw = parseInt(searchParams.get("per_page") || String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
    const perPage = Math.min(Math.max(perPageRaw, 1), MAX_PER_PAGE);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // recent: by created_at; top: by like_count (upvotes); controversial: by vote_controversy_score (LEAST(up, down))
    const sortRaw = (searchParams.get("sort") || "recent").toLowerCase();
    const sort: FeedSortMode =
      sortRaw === "top" || sortRaw === "controversial" ? sortRaw : "recent";

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

    let feedBuilder = supabase
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
        is_welcome_post,
        welcome_version,
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
        { count: "exact" }
      )
      .eq("circle_id", circleId)
      .eq("approval_status", "approved")
      .eq("publication_status", "published")
      .eq("is_welcome_post", false)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .in("content_type", ["post", "poll"] as CircleContentType[])
      .order("is_pinned", { ascending: false });

    if (sort === "top") {
      feedBuilder = feedBuilder
        .order("like_count", { ascending: false })
        .order("created_at", { ascending: false });
    } else if (sort === "controversial") {
      feedBuilder = feedBuilder
        .order("vote_controversy_score", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      feedBuilder = feedBuilder.order("created_at", { ascending: false });
    }

    const { data: contentRows, error: contentError, count } = await feedBuilder.range(from, to);

    const { data: welcomePostRow } = await supabase
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
        is_welcome_post,
        welcome_version,
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
      `
      )
      .eq("circle_id", circleId)
      .eq("is_welcome_post", true)
      .eq("approval_status", "approved")
      .eq("publication_status", "published")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (contentError) {
      console.error("Error fetching circle content feed:", contentError);
      return NextResponse.json({ error: "Failed to load content" }, { status: 500 });
    }

    const baseRows = (contentRows ?? []) as unknown as Omit<
      FeedItemBase,
      "author" | "sharer"
    >[];

    const profileIds = new Set<string>();
    for (const r of baseRows) {
      profileIds.add(r.author_id);
      if (r.shared_by) profileIds.add(r.shared_by);
    }

    const profileList = [...profileIds];
    let profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
    if (profileList.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", profileList);
      profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          { full_name: p.full_name ?? "", avatar_url: p.avatar_url ?? null },
        ])
      );
    }

    const baseItems: FeedItem[] = baseRows.map((r) => {
      const authorP = profileMap.get(r.author_id);
      const sharerP = r.shared_by ? profileMap.get(r.shared_by) : null;
      return {
        ...r,
        content_type: r.content_type as CircleContentType,
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

    const pollContentIds = baseItems.filter((i) => i.content_type === "poll").map((i) => i.id);
    if (pollContentIds.length > 0) {
      const { data: polls, error: pollsError } = await supabase
        .from("circle_polls")
        .select("id, content_id, circle_id, question, options")
        .in("content_id", pollContentIds);

      if (pollsError) {
        console.error("Error fetching polls for feed:", pollsError);
      } else if (polls && polls.length > 0) {
        const pollIds = polls.map((p) => p.id);
        const { data: resultsRows, error: resultsError } = await supabase
          .from("circle_poll_results")
          .select("poll_id, option_index, vote_count")
          .in("poll_id", pollIds);

        if (resultsError) {
          console.error("Error fetching poll results for feed:", resultsError);
        }

        const resultsByPollId = new Map<string, Array<{ option_index: number; vote_count: number }>>();
        for (const rr of resultsRows ?? []) {
          const r = rr as unknown as { poll_id: string; option_index: number; vote_count: number };
          const prev = resultsByPollId.get(r.poll_id) ?? [];
          prev.push({ option_index: r.option_index, vote_count: r.vote_count });
          resultsByPollId.set(r.poll_id, prev);
        }
        for (const [pollId, arr] of resultsByPollId) {
          arr.sort((a, b) => a.option_index - b.option_index);
          resultsByPollId.set(pollId, arr);
        }

        const pollByContentId = new Map<string, FeedPoll>();
        for (const p of polls) {
          const poll = p as unknown as {
            id: string;
            content_id: string;
            circle_id: string;
            question: string;
            options: unknown;
          };
          pollByContentId.set(poll.content_id, {
            id: poll.id,
            content_id: poll.content_id,
            circle_id: poll.circle_id,
            question: poll.question,
            options: parseOptions(poll.options),
            results: resultsByPollId.get(poll.id) ?? [],
          });
        }

        for (const item of baseItems) {
          if (item.content_type !== "poll") continue;
          const poll = pollByContentId.get(item.id);
          if (poll) item.poll = poll;
        }
      }
    }

    return NextResponse.json({
      welcome_post: welcomePostRow ?? null,
      content: baseItems,
      total: count ?? baseItems.length,
      page,
      per_page: perPage,
      sort,
    });
  } catch (err) {
    console.error("GET /api/circles/[id]/content:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

