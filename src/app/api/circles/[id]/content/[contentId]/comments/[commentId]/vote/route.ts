import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";
import { canVoteOnComment } from "@/lib/utils/circles/access-control";
import { isValidUuidParam, jsonInvalidId, jsonNotFound } from "@/lib/utils/circles/vote-api";
import { checkVoteMutationRateLimit } from "@/lib/utils/circles/vote-rate-limit";

type CircleVoteDirection = "up" | "down";

type RouteParams = { params: Promise<{ id: string; contentId: string; commentId: string }> };

/**
 * GET .../comments/[commentId]/vote
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId, commentId } = await params;
    if (!isValidUuidParam(circleId) || !isValidUuidParam(contentId) || !isValidUuidParam(commentId)) {
      return jsonInvalidId();
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: comment, error: commentError } = await supabase
      .from("circle_comments")
      .select("content_id, like_count, downvote_count")
      .eq("id", commentId)
      .maybeSingle();

    if (commentError) {
      return upstreamError("GET comment vote comment", "Failed to load vote state", commentError);
    }

    const c = comment as {
      content_id?: string;
      like_count?: number;
      downvote_count?: number;
    } | null;
    if (!c || c.content_id !== contentId) {
      return jsonNotFound();
    }

    const { data: content, error: contentError } = await supabase
      .from("circle_content")
      .select("circle_id")
      .eq("id", contentId)
      .maybeSingle();

    if (contentError) {
      return upstreamError("GET comment vote content", "Failed to load vote state", contentError);
    }

    if (!content || (content as { circle_id: string }).circle_id !== circleId) {
      return jsonNotFound();
    }

    const counts = {
      like_count: c.like_count ?? 0,
      downvote_count: c.downvote_count ?? 0,
    };

    if (!user) {
      return NextResponse.json({ my_vote: null as CircleVoteDirection | null, ...counts });
    }

    const allowed = await canVoteOnComment(commentId, user.id);
    if (!allowed) {
      return jsonNotFound();
    }

    const { data: voteRow, error: voteError } = await supabase
      .from("circle_comment_votes")
      .select("vote_type")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (voteError) {
      return upstreamError("GET comment vote row", "Failed to load vote state", voteError);
    }

    const vt = (voteRow as { vote_type?: CircleVoteDirection } | null)?.vote_type;
    const my_vote = vt === "up" || vt === "down" ? vt : null;

    return NextResponse.json({ my_vote, ...counts });
  } catch (err) {
    return internalServerError("GET comment vote:", err);
  }
}

/**
 * POST .../comments/[commentId]/vote
 * Body: { vote: "up" | "down" | null }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId, commentId } = await params;
    if (!isValidUuidParam(circleId) || !isValidUuidParam(contentId) || !isValidUuidParam(commentId)) {
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

    const { data: comment, error: commentErr } = await supabase
      .from("circle_comments")
      .select("content_id")
      .eq("id", commentId)
      .maybeSingle();

    if (commentErr) {
      return upstreamError("POST comment vote load comment", "Could not update vote", commentErr);
    }

    const c = comment as { content_id?: string } | null;
    if (!c || c.content_id !== contentId) {
      return jsonNotFound();
    }

    const { data: content, error: contentErr } = await supabase
      .from("circle_content")
      .select("circle_id")
      .eq("id", contentId)
      .maybeSingle();

    if (contentErr) {
      return upstreamError("POST comment vote load content", "Could not update vote", contentErr);
    }

    if (!content || (content as { circle_id: string }).circle_id !== circleId) {
      return jsonNotFound();
    }

    const allowed = await canVoteOnComment(commentId, user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to vote on this comment" },
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
        .from("circle_comment_votes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      if (delErr) {
        return upstreamError("POST comment vote delete", "Could not update vote", delErr);
      }
    } else {
      const { data: existing, error: exErr } = await supabase
        .from("circle_comment_votes")
        .select("id, vote_type")
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (exErr) {
        return upstreamError("POST comment vote select", "Could not update vote", exErr);
      }

      const ex = existing as { id: string; vote_type: CircleVoteDirection } | null;
      if (ex && ex.vote_type === requested) {
        const { error: delErr } = await supabase.from("circle_comment_votes").delete().eq("id", ex.id);
        if (delErr) {
          return upstreamError("POST comment vote toggle delete", "Could not update vote", delErr);
        }
      } else if (ex) {
        const { error: upErr } = await supabase
          .from("circle_comment_votes")
          .update({ vote_type: requested })
          .eq("id", ex.id);
        if (upErr) {
          return upstreamError("POST comment vote update", "Could not update vote", upErr);
        }
      } else {
        const { error: insErr } = await supabase.from("circle_comment_votes").insert({
          comment_id: commentId,
          user_id: user.id,
          vote_type: requested,
        });
        if (insErr) {
          return upstreamError("POST comment vote insert", "Could not update vote", insErr);
        }
      }
    }

    const { data: updated, error: uErr } = await supabase
      .from("circle_comments")
      .select("like_count, downvote_count")
      .eq("id", commentId)
      .maybeSingle();

    if (uErr) {
      return upstreamError("POST comment vote reload comment", "Could not update vote", uErr);
    }

    const { data: voteRow, error: vErr } = await supabase
      .from("circle_comment_votes")
      .select("vote_type")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (vErr) {
      return upstreamError("POST comment vote reload vote", "Could not update vote", vErr);
    }

    const vt = (voteRow as { vote_type?: CircleVoteDirection } | null)?.vote_type;
    const my_vote = vt === "up" || vt === "down" ? vt : null;

    return NextResponse.json({
      my_vote,
      like_count: (updated as { like_count?: number } | null)?.like_count ?? 0,
      downvote_count: (updated as { downvote_count?: number } | null)?.downvote_count ?? 0,
    });
  } catch (err) {
    return internalServerError("POST comment vote:", err);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId, commentId } = await params;
    if (!isValidUuidParam(circleId) || !isValidUuidParam(contentId) || !isValidUuidParam(commentId)) {
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

    const { data: comment, error: commentErr } = await supabase
      .from("circle_comments")
      .select("content_id")
      .eq("id", commentId)
      .maybeSingle();

    if (commentErr) {
      return upstreamError("DELETE comment vote load comment", "Could not update vote", commentErr);
    }

    const c = comment as { content_id?: string } | null;
    if (!c || c.content_id !== contentId) {
      return jsonNotFound();
    }

    const { data: content, error: contentErr } = await supabase
      .from("circle_content")
      .select("circle_id")
      .eq("id", contentId)
      .maybeSingle();

    if (contentErr) {
      return upstreamError("DELETE comment vote load content", "Could not update vote", contentErr);
    }

    if (!content || (content as { circle_id: string }).circle_id !== circleId) {
      return jsonNotFound();
    }

    const allowed = await canVoteOnComment(commentId, user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to vote on this comment" },
        { status: 403 }
      );
    }

    const { error: delErr } = await supabase
      .from("circle_comment_votes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);

    if (delErr) {
      return upstreamError("DELETE comment vote", "Could not update vote", delErr);
    }

    const { data: updated, error: uErr } = await supabase
      .from("circle_comments")
      .select("like_count, downvote_count")
      .eq("id", commentId)
      .maybeSingle();

    if (uErr) {
      return upstreamError("DELETE comment vote reload", "Could not update vote", uErr);
    }

    return NextResponse.json({
      my_vote: null as CircleVoteDirection | null,
      like_count: (updated as { like_count?: number } | null)?.like_count ?? 0,
      downvote_count: (updated as { downvote_count?: number } | null)?.downvote_count ?? 0,
    });
  } catch (err) {
    return internalServerError("DELETE comment vote:", err);
  }
}
