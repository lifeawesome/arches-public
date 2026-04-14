"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Markdown } from "@/components/common/Markdown";
import type {
  CircleContentWithAuthor,
  CircleDirectoryItem,
  CircleCommentApiRow,
  CircleVoteType,
} from "@/types/circles";
import { ArrowLeft, ThumbsDown, ThumbsUp } from "lucide-react";
import { SharedContentBanner } from "@/components/circles/share/SharedContentBanner";
import { ShareToCircleModal, type ShareModalSource } from "@/components/circles/share/ShareToCircleModal";
import { ShareToCircleTrigger } from "@/components/circles/share/ShareToCircleTrigger";

const API_CIRCLE_BLOCKED = "circle_blocked";

type UserRole = "owner" | "moderator" | "contributor" | "member" | null;

export default function CirclePostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const contentId = params?.contentId as string;

  const [circle, setCircle] = useState<CircleDirectoryItem | null>(null);
  const [content, setContent] = useState<CircleContentWithAuthor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [myVote, setMyVote] = useState<CircleVoteType | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [downvoteCount, setDownvoteCount] = useState(0);
  const [voting, setVoting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSource, setShareSource] = useState<ShareModalSource | null>(null);

  const [comments, setComments] = useState<CircleCommentApiRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentVoteById, setCommentVoteById] = useState<Record<string, CircleVoteType>>({});
  const [votingCommentId, setVotingCommentId] = useState<string | null>(null);

  const commentIdsKey = useMemo(
    () =>
      [...comments.map((c) => c.id)]
        .sort()
        .join(","),
    [comments]
  );

  useEffect(() => {
    if (!slug || !contentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/circles/by-slug/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) {
            const data = (await res.json().catch(() => ({}))) as { code?: string };
            if (data?.code === API_CIRCLE_BLOCKED) {
              return { blocked: true as const };
            }
          }
          return { blocked: false as const, circle: null };
        }
        const data = await res.json();
        return { blocked: false as const, circle: data.circle as CircleDirectoryItem | null };
      })
      .then(async (result) => {
        if (cancelled) return;
        if (result.blocked) {
          setError("You don’t have access to this circle.");
          setLoading(false);
          return;
        }
        const c = result.circle;
        setCircle(c);
        if (!c) {
          setError("Circle not found");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/circles/${encodeURIComponent(c.id)}/content/${encodeURIComponent(contentId)}`
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Post not found");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { content: CircleContentWithAuthor };
        setContent(data.content);
        setLikeCount(data.content.like_count);
        setDownvoteCount(data.content.downvote_count ?? 0);

        const viewKey = `circle_content_view:${data.content.id}`;
        if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(viewKey)) {
          sessionStorage.setItem(viewKey, "1");
          void fetch(
            `/api/circles/${encodeURIComponent(c.id)}/content/${encodeURIComponent(contentId)}/view`,
            { method: "POST" }
          );
        }

        const me = await fetch(`/api/circles/${encodeURIComponent(c.id)}/me`);
        if (me.ok) {
          const r = await me.json();
          setUserRole(r.role ?? null);
        }

        const voteRes = await fetch(`/api/circle-content/${encodeURIComponent(data.content.id)}/vote`);
        if (voteRes.ok) {
          const v = (await voteRes.json()) as {
            my_vote: CircleVoteType | null;
            like_count: number;
            downvote_count: number;
          };
          setMyVote(v.my_vote);
          setLikeCount(v.like_count);
          setDownvoteCount(v.downvote_count);
        }

        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, contentId]);

  useEffect(() => {
    if (!circle || !contentId || !userRole) {
      if (!userRole) setCommentVoteById({});
      return;
    }
    let cancelled = false;
    setCommentsLoading(true);
    void fetch(
      `/api/circles/${encodeURIComponent(circle.id)}/content/${encodeURIComponent(contentId)}/comments`
    )
      .then(async (res) => {
        if (!res.ok) return { comments: [] as CircleCommentApiRow[] };
        return res.json() as Promise<{ comments: CircleCommentApiRow[] }>;
      })
      .then((data) => {
        if (!cancelled) setComments(data.comments ?? []);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [circle, contentId, userRole]);

  useEffect(() => {
    if (!userRole || comments.length === 0) {
      if (!userRole) setCommentVoteById({});
      return;
    }
    let cancelled = false;
    const ids = comments.map((c) => c.id);
    void fetch("/api/circle-content/my-comment-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_ids: ids }),
    })
      .then(async (res) => {
        if (res.status === 401) return { votes: {} as Record<string, CircleVoteType> };
        if (!res.ok) return null;
        return res.json() as Promise<{ votes: Record<string, CircleVoteType> }>;
      })
      .then((data) => {
        if (!cancelled && data?.votes) setCommentVoteById(data.votes);
      });
    return () => {
      cancelled = true;
    };
  }, [userRole, commentIdsKey]);

  const handleContentVote = async (direction: CircleVoteType) => {
    if (!userRole || voting || !content) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/circle-content/${encodeURIComponent(content.id)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: direction }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        my_vote: CircleVoteType | null;
        like_count: number;
        downvote_count: number;
      };
      setMyVote(data.my_vote);
      setLikeCount(data.like_count);
      setDownvoteCount(data.downvote_count);
    } finally {
      setVoting(false);
    }
  };

  const handleCommentVote = async (commentId: string, direction: CircleVoteType) => {
    if (!userRole || votingCommentId || !circle) return;
    setVotingCommentId(commentId);
    try {
      const res = await fetch(
        `/api/circles/${encodeURIComponent(circle.id)}/content/${encodeURIComponent(contentId)}/comments/${encodeURIComponent(commentId)}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote: direction }),
        }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        my_vote: CircleVoteType | null;
        like_count: number;
        downvote_count: number;
      };
      setCommentVoteById((prev) => {
        const next = { ...prev };
        if (data.my_vote) next[commentId] = data.my_vote;
        else delete next[commentId];
        return next;
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                like_count: data.like_count,
                downvote_count: data.downvote_count,
              }
            : c
        )
      );
    } finally {
      setVotingCommentId(null);
    }
  };

  const openSharePost = () => {
    if (!content || content.content_type !== "post") return;
    setShareSource({ kind: "circle_content", contentId: content.id });
    setShareOpen(true);
  };

  const isUp = myVote === "up";
  const isDown = myVote === "down";

  return (
    <>
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <button
          type="button"
          onClick={() => router.push(`/circles/${encodeURIComponent(slug)}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to circle
        </button>

        {loading && <p className="text-muted-foreground">Loading…</p>}
        {error && !loading && <p className="text-destructive">{error}</p>}

        {!loading && !error && circle && content && (
          <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <SharedContentBanner
              sharedFrom={content.shared_from}
              sharerName={content.sharer?.full_name || content.author.full_name || undefined}
            />
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-semibold text-foreground">{content.title}</h1>
              <time className="shrink-0 text-xs text-muted-foreground">
                {new Date(content.created_at).toLocaleString()}
              </time>
            </div>
            <div className="prose prose-sm mt-4 max-w-none dark:prose-invert">
              <Markdown>{content.content}</Markdown>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">
                {content.shared_from ? "Shared by" : "Posted by"}{" "}
                {content.author.full_name || "Member"}
              </span>
              {userRole && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleContentVote("up")}
                    disabled={voting}
                    className={`inline-flex items-center gap-1 text-xs ${
                      isUp ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={isUp ? "Remove upvote" : "Upvote"}
                  >
                    <ThumbsUp className={`h-3.5 w-3.5 ${isUp ? "fill-current" : ""}`} />
                    {likeCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleContentVote("down")}
                    disabled={voting}
                    className={`inline-flex items-center gap-1 text-xs ${
                      isDown ? "font-medium text-destructive" : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={isDown ? "Remove downvote" : "Downvote"}
                  >
                    <ThumbsDown className={`h-3.5 w-3.5 ${isDown ? "fill-current" : ""}`} />
                    {downvoteCount}
                  </button>
                </>
              )}
              {!userRole && (
                <span className="text-xs text-muted-foreground">
                  {likeCount} up · {downvoteCount} down
                </span>
              )}
              {userRole && content.content_type === "post" && (
                <ShareToCircleTrigger onClick={openSharePost} />
              )}
            </div>
          </article>
        )}

        {!loading && !error && circle && content && userRole && (
          <section className="mt-10 border-t border-border pt-8">
            <h2 className="text-lg font-semibold text-foreground">Comments</h2>
            {commentsLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {comments.map((c) => {
                  const cv = commentVoteById[c.id];
                  const cup = cv === "up";
                  const cdown = cv === "down";
                  const cdv = c.downvote_count ?? 0;
                  return (
                    <li key={c.id} className="rounded-md border border-border bg-card/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        {c.author.full_name || "Member"} · {new Date(c.created_at).toLocaleString()}
                      </p>
                      <div className="prose prose-sm mt-1 max-w-none dark:prose-invert">
                        <Markdown>{c.comment_text}</Markdown>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleCommentVote(c.id, "up")}
                          disabled={votingCommentId === c.id}
                          className={`inline-flex items-center gap-1 text-xs disabled:opacity-50 ${
                            cup ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"
                          }`}
                          aria-label={cup ? "Remove upvote" : "Upvote comment"}
                        >
                          <ThumbsUp className={`h-3 w-3 ${cup ? "fill-current" : ""}`} />
                          {c.like_count}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCommentVote(c.id, "down")}
                          disabled={votingCommentId === c.id}
                          className={`inline-flex items-center gap-1 text-xs disabled:opacity-50 ${
                            cdown
                              ? "font-medium text-destructive"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          aria-label={cdown ? "Remove downvote" : "Downvote comment"}
                        >
                          <ThumbsDown className={`h-3 w-3 ${cdown ? "fill-current" : ""}`} />
                          {cdv}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <ShareToCircleModal
          open={shareOpen}
          onOpenChange={(o) => {
            setShareOpen(o);
            if (!o) setShareSource(null);
          }}
          source={shareSource}
          excludeCircleId={circle?.id}
          onSuccess={() => {
            if (circle) router.push(`/circles/${encodeURIComponent(slug)}`);
          }}
        />
      </main>
      <Footer />
    </>
  );
}
