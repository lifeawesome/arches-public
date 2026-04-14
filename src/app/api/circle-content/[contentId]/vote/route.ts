import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";
import { canVoteOnContent } from "@/lib/utils/circles/access-control";
import { isValidUuidParam, jsonInvalidId, jsonNotFound } from "@/lib/utils/circles/vote-api";
import { checkVoteMutationRateLimit } from "@/lib/utils/circles/vote-rate-limit";

export type CircleVoteDirection = "up" | "down";

type RouteParams = { params: Promise<{ contentId: string }> };

/**
 * GET /api/circle-content/[contentId]/vote
 * Counts only if the row is visible under RLS. Authenticated users additionally
 * need canVoteOnContent (same as POST) to avoid leaking aggregates when policy drifts.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    if (!isValidUuidParam(contentId)) {
      return jsonInvalidId();
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: content, error: contentError } = await supabase
      .from("circle_content")
      .select("like_count, downvote_count")
      .eq("id", contentId)
      .maybeSingle();

    if (contentError) {
      return upstreamError(
        "GET /api/circle-content/[contentId]/vote content",
        "Failed to load vote state",
        contentError
      );
    }

    if (!content) {
      return jsonNotFound();
    }

    if (user) {
      const allowed = await canVoteOnContent(contentId, user.id);
      if (!allowed) {
        return jsonNotFound();
      }
    }

    const counts = {
      like_count: (content as { like_count?: number; downvote_count?: number }).like_count ?? 0,
      downvote_count:
        (content as { like_count?: number; downvote_count?: number }).downvote_count ?? 0,
    };

    if (!user) {
      return NextResponse.json({ my_vote: null as CircleVoteDirection | null, ...counts });
    }

    const { data: voteRow, error: voteError } = await supabase
      .from("circle_content_votes")
      .select("vote_type")
      .eq("content_id", contentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (voteError) {
      return upstreamError(
        "GET /api/circle-content/[contentId]/vote vote row",
        "Failed to load vote state",
        voteError
      );
    }

    const vt = (voteRow as { vote_type?: CircleVoteDirection } | null)?.vote_type;
    const my_vote = vt === "up" || vt === "down" ? vt : null;

    return NextResponse.json({ my_vote, ...counts });
  } catch (err) {
    return internalServerError("GET /api/circle-content/[contentId]/vote:", err);
  }
}

/**
 * POST /api/circle-content/[contentId]/vote
 * Body: { vote: "up" | "down" | null } — null clears. Repeating the same vote clears (toggle off).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    if (!isValidUuidParam(contentId)) {
      return jsonInvalidId();
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = checkVoteMutationRateLimit(user.id);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many vote requests. Try again later.", retryAfterSeconds: rate.retryAfterSeconds },
        {
          status: 429,
          headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined,
        }
      );
    }

    const allowed = await canVoteOnContent(contentId, user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to vote on this content" },
        { status: 403 }
      );
    }

    let body: { vote?: CircleVoteDirection | null } = {};
    try {
      body = (await request.json()) as { vote?: CircleVoteDirection | null };
    } catch {
      body = {};
    }

    const requested = body.vote;
    if (requested !== "up" && requested !== "down" && requested !== null && requested !== undefined) {
      return NextResponse.json(
        { error: "Invalid body", details: 'vote must be "up", "down", or null' },
        { status: 400 }
      );
    }

    if (requested === null || requested === undefined) {
      const { error: delErr } = await supabase
        .from("circle_content_votes")
        .delete()
        .eq("content_id", contentId)
        .eq("user_id", user.id);
      if (delErr) {
        return upstreamError(
          "POST /api/circle-content/[contentId]/vote delete",
          "Could not update vote",
          delErr
        );
      }
    } else {
      const { data: existing, error: exErr } = await supabase
        .from("circle_content_votes")
        .select("id, vote_type")
        .eq("content_id", contentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (exErr) {
        return upstreamError(
          "POST /api/circle-content/[contentId]/vote select",
          "Could not update vote",
          exErr
        );
      }

      const ex = existing as { id: string; vote_type: CircleVoteDirection } | null;
      if (ex && ex.vote_type === requested) {
        const { error: delErr } = await supabase.from("circle_content_votes").delete().eq("id", ex.id);
        if (delErr) {
          return upstreamError(
            "POST /api/circle-content/[contentId]/vote toggle delete",
            "Could not update vote",
            delErr
          );
        }
      } else if (ex) {
        const { error: upErr } = await supabase
          .from("circle_content_votes")
          .update({ vote_type: requested })
          .eq("id", ex.id);
        if (upErr) {
          return upstreamError(
            "POST /api/circle-content/[contentId]/vote update",
            "Could not update vote",
            upErr
          );
        }
      } else {
        const { error: insErr } = await supabase.from("circle_content_votes").insert({
          content_id: contentId,
          user_id: user.id,
          vote_type: requested,
        });
        if (insErr) {
          return upstreamError(
            "POST /api/circle-content/[contentId]/vote insert",
            "Could not update vote",
            insErr
          );
        }
      }
    }

    const { data: contentAfter, error: cErr } = await supabase
      .from("circle_content")
      .select("like_count, downvote_count")
      .eq("id", contentId)
      .maybeSingle();

    if (cErr) {
      return upstreamError(
        "POST /api/circle-content/[contentId]/vote reload counts",
        "Could not update vote",
        cErr
      );
    }

    const { data: voteRow, error: vErr } = await supabase
      .from("circle_content_votes")
      .select("vote_type")
      .eq("content_id", contentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (vErr) {
      return upstreamError(
        "POST /api/circle-content/[contentId]/vote reload vote",
        "Could not update vote",
        vErr
      );
    }

    const vt = (voteRow as { vote_type?: CircleVoteDirection } | null)?.vote_type;
    const my_vote = vt === "up" || vt === "down" ? vt : null;

    return NextResponse.json({
      my_vote,
      like_count: (contentAfter as { like_count?: number } | null)?.like_count ?? 0,
      downvote_count: (contentAfter as { downvote_count?: number } | null)?.downvote_count ?? 0,
    });
  } catch (err) {
    return internalServerError("POST /api/circle-content/[contentId]/vote:", err);
  }
}

/**
 * DELETE /api/circle-content/[contentId]/vote
 * Clears the current user's vote.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    if (!isValidUuidParam(contentId)) {
      return jsonInvalidId();
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = checkVoteMutationRateLimit(user.id);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many vote requests. Try again later.", retryAfterSeconds: rate.retryAfterSeconds },
        {
          status: 429,
          headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined,
        }
      );
    }

    const allowed = await canVoteOnContent(contentId, user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to vote on this content" },
        { status: 403 }
      );
    }

    const { error: delErr } = await supabase
      .from("circle_content_votes")
      .delete()
      .eq("content_id", contentId)
      .eq("user_id", user.id);

    if (delErr) {
      return upstreamError(
        "DELETE /api/circle-content/[contentId]/vote",
        "Could not update vote",
        delErr
      );
    }

    const { data: contentAfter, error: cErr } = await supabase
      .from("circle_content")
      .select("like_count, downvote_count")
      .eq("id", contentId)
      .maybeSingle();

    if (cErr) {
      return upstreamError(
        "DELETE /api/circle-content/[contentId]/vote counts",
        "Could not update vote",
        cErr
      );
    }

    return NextResponse.json({
      my_vote: null as CircleVoteDirection | null,
      like_count: (contentAfter as { like_count?: number } | null)?.like_count ?? 0,
      downvote_count: (contentAfter as { downvote_count?: number } | null)?.downvote_count ?? 0,
    });
  } catch (err) {
    return internalServerError("DELETE /api/circle-content/[contentId]/vote:", err);
  }
}
