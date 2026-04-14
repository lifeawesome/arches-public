import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  canPostInCircle,
  getGuidelinesAckRequirement,
  resolveInitialApprovalStatus,
} from "@/lib/utils/circles/access-control";
import {
  enforceMarkdownLength,
  hasRenderableMarkdownContent,
  markdownLimits,
  normalizeMarkdownInput,
} from "@/lib/utils/markdown";
import type { CircleContentType } from "@/types/circles";
import { extractMentionHandles } from "@/lib/circles/mentions";
import { applyMentionsAfterContentSave, validateCircleMentionText } from "@/lib/circles/mention-sync";

type RouteParams = { params: Promise<{ id: string }> };

type CreatePollBody = {
  question: string;
  options: string[];
  is_free?: boolean;
  title?: string;
};

function normalizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => String(o ?? "").trim())
    .filter((o) => o.length > 0);
}

/**
 * POST /api/circles/[id]/polls
 * Creates a poll as circle_content(content_type='poll') + circle_polls row.
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
      .select("id")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const canPost = await canPostInCircle(circleId, user.id);
    if (!canPost) {
      return NextResponse.json({ error: "You are not allowed to post in this circle" }, { status: 403 });
    }
    const ackState = await getGuidelinesAckRequirement(circleId, user.id);
    if (ackState.required && !ackState.acknowledged) {
      return NextResponse.json(
        { error: "Please acknowledge the latest circle guidelines before posting.", code: "guidelines_ack_required" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Partial<CreatePollBody>;
    const question = normalizeMarkdownInput(body.question);
    const options = normalizeOptions(body.options);

    if (!question || !hasRenderableMarkdownContent(question)) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }
    const lengthError = enforceMarkdownLength(question, markdownLimits.maxLength);
    if (lengthError) {
      return NextResponse.json({ error: lengthError }, { status: 400 });
    }
    if (options.length < 2) {
      return NextResponse.json({ error: "At least 2 options are required" }, { status: 400 });
    }
    if (options.length > 10) {
      return NextResponse.json({ error: "At most 10 options are allowed" }, { status: 400 });
    }

    const title = String(body.title ?? "").trim() || "Poll";
    let content = question; // keep circle_content.content aligned with poll.question
    let mentionPairs: { username: string; userId: string }[] | null = null;
    if (extractMentionHandles(question).length > 0) {
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
        circleId,
        text: question,
        authorId: user.id,
      });
      if (!mentionPrep.ok) {
        return NextResponse.json({ error: mentionPrep.error }, { status: mentionPrep.status });
      }
      content = mentionPrep.rewrittenText;
      mentionPairs = mentionPrep.pairs;
    }
    const isFree = body.is_free ?? false;

    // Determine approval status based on circle settings + author role
    const approvalStatus = await resolveInitialApprovalStatus(circleId, user.id);
    const isPublished = approvalStatus === "approved";
    const nowIso = new Date().toISOString();

    // 1) Create circle_content row
    const { data: insertedContent, error: contentError } = await supabase
      .from("circle_content")
      .insert({
        circle_id: circleId,
        author_id: user.id,
        title,
        content,
        content_type: "poll" as CircleContentType,
        is_free: isFree,
        is_published: isPublished,
        approval_status: approvalStatus,
        publication_status: "published",
        scheduled_for: null,
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
        view_count,
        like_count,
        downvote_count,
        comment_count,
        published_at,
        created_at,
        updated_at
      `
      )
      .single();

    if (contentError || !insertedContent) {
      console.error("Error creating poll content:", contentError);
      return NextResponse.json({ error: "Failed to create poll" }, { status: 500 });
    }

    const contentId = (insertedContent as { id: string }).id;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && mentionPairs && mentionPairs.length > 0) {
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const applyErr = await applyMentionsAfterContentSave({
        admin: mentionAdmin,
        circleId,
        contentId,
        commentId: null,
        authorId: user.id,
        pairs: mentionPairs,
      });
      if (applyErr.error) {
        console.error("[polls] mentions:", applyErr.error);
      }
    }

    // 2) Create circle_polls row (triggers initialize results)
    const { data: pollRow, error: pollError } = await supabase
      .from("circle_polls")
      .insert({
        circle_id: circleId,
        content_id: contentId,
        question: content,
        options,
      })
      .select("id, content_id, circle_id, question, options")
      .single();

    if (pollError || !pollRow) {
      console.error("Error creating circle_polls row:", pollError);
      // Best-effort cleanup to avoid orphan circle_content
      await supabase.from("circle_content").delete().eq("id", contentId);
      return NextResponse.json({ error: "Failed to create poll" }, { status: 500 });
    }

    const pollId = (pollRow as { id: string }).id;
    const { data: resultsRows } = await supabase
      .from("circle_poll_results")
      .select("poll_id, option_index, vote_count")
      .eq("poll_id", pollId)
      .order("option_index", { ascending: true });

    return NextResponse.json(
      {
        pending: approvalStatus === "pending",
        content: isPublished ? {
          ...(insertedContent as object),
          content_type: "poll" as CircleContentType,
          author: { id: user.id, full_name: "", avatar_url: null },
          poll: {
            id: pollId,
            content_id: contentId,
            circle_id: circleId,
            question: content,
            options,
            results: (resultsRows ?? []).map((r) => {
              const row = r as unknown as { option_index: number; vote_count: number };
              return { option_index: row.option_index, vote_count: row.vote_count };
            }),
          },
        } : null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/circles/[id]/polls:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

