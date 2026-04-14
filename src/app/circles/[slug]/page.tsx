"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { PublicCircleBadge } from "@/components/circles/PublicCircleBadge";
import { CircleStats } from "@/components/circles/CircleStats";
import type {
  CircleDirectoryItem,
  CircleFeedItem,
  CircleMemberRole,
  CircleVoteType,
} from "@/types/circles";
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Pin,
  Shield,
  Trash2,
  CheckCircle,
  Flag,
  Ban,
  Link2,
} from "lucide-react";

/** Matches `CIRCLE_BLOCKED_ERROR_CODE` from API (`access-denied-response.ts`). */
const API_CIRCLE_BLOCKED = "circle_blocked";
import { CirclePollCard } from "@/components/circles/polls/CirclePollCard";
import { CircleMarkdownEditor } from "@/components/circles/CircleMarkdownEditor";
import { Markdown } from "@/components/common/Markdown";
import { SharedContentBanner } from "@/components/circles/share/SharedContentBanner";
import {
  ShareToCircleModal,
  type ShareModalSource,
} from "@/components/circles/share/ShareToCircleModal";
import { ShareToCircleTrigger } from "@/components/circles/share/ShareToCircleTrigger";
import {
  MAX_REPORT_DESCRIPTION_LENGTH,
  REPORT_REASON_LABELS,
  REPORT_REASON_VALUES,
  type ReportReason,
} from "@/lib/reports/report-reasons";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";

type UserRole = CircleMemberRole | "owner" | null;
type WelcomePost = { id: string | null; title: string; content: string; welcome_version?: number } | null;
type FeedSortMode = "recent" | "top" | "controversial";

export default function CircleBySlugPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [circle, setCircle] = useState<CircleDirectoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [blockedFromCircle, setBlockedFromCircle] = useState(false);
  const [feed, setFeed] = useState<CircleFeedItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<"post" | "poll">("post");
  const [newPostContent, setNewPostContent] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postSuccessMessage, setPostSuccessMessage] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [showPostPreview, setShowPostPreview] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [draftPosts, setDraftPosts] = useState<
    Array<{
      id: string;
      title: string;
      content: string;
      publication_status: string;
      scheduled_for: string | null;
      updated_at: string;
    }>
  >([]);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Role-based state
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [feedSort, setFeedSort] = useState<FeedSortMode>("recent");
  const [contentVoteById, setContentVoteById] = useState<Record<string, CircleVoteType>>({});
  const [votingContentId, setVotingContentId] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [reportModal, setReportModal] = useState<
    | { kind: "content"; contentId: string; title: string }
    | { kind: "circle"; title: string }
    | null
  >(null);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareSource, setShareSource] = useState<ShareModalSource | null>(null);
  const [welcomePost, setWelcomePost] = useState<WelcomePost>(null);
  const [guidelinesAckRequired, setGuidelinesAckRequired] = useState(false);
  const [guidelinesAcked, setGuidelinesAcked] = useState(false);
  const [guidelinesAckLoading, setGuidelinesAckLoading] = useState(false);
  const [guidelinesAckSaving, setGuidelinesAckSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isModerator = userRole === "moderator" || userRole === "owner";
  const canCompose = userRole !== null;
  const backToDirectoryHref = isAuthenticated ? "/dashboard/circles" : "/circles";

  const feedIdsKey = useMemo(
    () =>
      [...feed.map((f) => f.id)]
        .sort()
        .join(","),
    [feed]
  );

  useEffect(() => {
    if (!userRole || feed.length === 0) {
      if (!userRole) setContentVoteById({});
      return;
    }
    let cancelled = false;
    const ids = feed.map((item) => item.id);
    void fetch("/api/circle-content/my-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_ids: ids }),
    })
      .then(async (res) => {
        if (res.status === 401) return { votes: {} as Record<string, CircleVoteType> };
        if (!res.ok) return null;
        return res.json() as Promise<{ votes: Record<string, CircleVoteType> }>;
      })
      .then((data) => {
        if (!cancelled && data?.votes) setContentVoteById(data.votes);
      });
    return () => {
      cancelled = true;
    };
  }, [userRole, feedIdsKey]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setBlockedFromCircle(false);
    fetch(`/api/circles/by-slug/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 403) {
            const data = (await res.json().catch(() => ({}))) as { code?: string };
            if (data?.code === API_CIRCLE_BLOCKED) {
              setBlockedFromCircle(true);
              setNotFound(false);
              setCircle(null);
              return;
            }
          }
          setNotFound(true);
          setCircle(null);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const nextCircle = (data?.circle ?? null) as CircleDirectoryItem | null;
        setCircle(nextCircle);
        if (nextCircle) {
          void loadPosts(nextCircle.id);
          void fetchUserRole(nextCircle.id);
          void loadWelcome(nextCircle.id);
          void loadGuidelinesAck(nextCircle.id);
          void loadDrafts(nextCircle.id);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseClient();
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setIsAuthenticated(Boolean(data.user));
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchCircleQuietly = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/circles/by-slug/${encodeURIComponent(slug)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { circle?: CircleDirectoryItem };
      const nextCircle = data?.circle ?? null;
      if (nextCircle) setCircle(nextCircle);
    } catch {
      // Non-blocking: keep existing circle data
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void refetchCircleQuietly();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [slug, refetchCircleQuietly]);

  const fetchUserRole = async (circleId: string) => {
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circleId)}/me`);
      if (res.ok) {
        const data = await res.json();
        const role = data.role as UserRole;
        setUserRole(role);
        // Fetch pending count for moderators/owners
        if (role === "moderator" || role === "owner") {
          void fetch(`/api/circles/${encodeURIComponent(circleId)}/moderation/count`)
            .then((r) => (r.ok ? r.json() : { pending_count: 0 }))
            .then((d) => setPendingCount(d.pending_count ?? 0))
            .catch(() => undefined);
        }
      }
    } catch {
      // User not authenticated or not a member — composer and moderation controls will be hidden.
    }
  };

  const loadWelcome = async (circleId: string) => {
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circleId)}/welcome`);
      if (!res.ok) return;
      const data = (await res.json()) as { welcome_post?: WelcomePost };
      setWelcomePost(data.welcome_post ?? null);
    } catch {
      // Non-blocking UI enhancement
    }
  };

  const loadGuidelinesAck = async (circleId: string) => {
    setGuidelinesAckLoading(true);
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circleId)}/guidelines-ack`);
      if (!res.ok) return;
      const data = (await res.json()) as { required: boolean; acknowledged: boolean };
      setGuidelinesAckRequired(data.required);
      setGuidelinesAcked(data.acknowledged);
    } catch {
      // Ignore; posting endpoint still enforces policy.
    } finally {
      setGuidelinesAckLoading(false);
    }
  };

  const acknowledgeGuidelines = async () => {
    if (!circle || guidelinesAckSaving) return;
    setGuidelinesAckSaving(true);
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circle.id)}/guidelines-ack`, {
        method: "POST",
      });
      if (res.ok) setGuidelinesAcked(true);
    } finally {
      setGuidelinesAckSaving(false);
    }
  };

  const loadPosts = async (circleId: string, sort: FeedSortMode = feedSort) => {
    setLoadingPosts(true);
    setPostError(null);
    try {
      const res = await fetch(
        `/api/circles/${encodeURIComponent(circleId)}/content?sort=${encodeURIComponent(sort)}`
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        if (res.status === 403 && data?.code === API_CIRCLE_BLOCKED) {
          setBlockedFromCircle(true);
          setFeed([]);
          setUserRole(null);
          return;
        }
        throw new Error(data?.error ?? "Failed to load posts");
      }
      const data = (await res.json()) as { content: CircleFeedItem[] };
      setBlockedFromCircle(false);
      setFeed(data.content ?? []);
    } catch (err) {
      setPostError((err as Error).message);
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadDrafts = useCallback(async (circleId: string) => {
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circleId)}/posts/drafts`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        posts?: Array<{
          id: string;
          title: string;
          content: string;
          publication_status: string;
          scheduled_for: string | null;
          updated_at: string;
        }>;
      };
      setDraftPosts(data.posts ?? []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    if (!circle?.id || !userRole) return;
    void loadDrafts(circle.id);
  }, [circle?.id, userRole, loadDrafts]);

  useEffect(() => {
    if (!circle?.id || !activeDraftId || !newPostContent.trim()) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void fetch(`/api/circles/${encodeURIComponent(circle.id)}/posts/${encodeURIComponent(activeDraftId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPostContent }),
      }).catch(() => undefined);
    }, 2000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [newPostContent, activeDraftId, circle?.id]);

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circle || !newPostContent.trim() || submittingPost) return;
    setSubmittingPost(true);
    setPostError(null);
    setPostSuccessMessage(null);
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circle.id)}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newPostContent.trim(), mode: "publish" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create post");
      }
      const data = (await res.json()) as { post: CircleFeedItem; pending?: boolean };
      if (data.pending) {
        setPostSuccessMessage("Your post has been submitted for approval.");
      } else {
        const p = data.post;
        setFeed((prev) => [
          { ...p, downvote_count: p.downvote_count ?? 0 },
          ...prev,
        ]);
        setPostSuccessMessage("Your post has been published.");
      }
      setNewPostContent("");
      setActiveDraftId(null);
      void loadDrafts(circle.id);
    } catch (err) {
      setPostError((err as Error).message);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!circle || submittingPost) return;
    setSubmittingPost(true);
    setPostError(null);
    setPostSuccessMessage(null);
    try {
      if (activeDraftId) {
        const res = await fetch(
          `/api/circles/${encodeURIComponent(circle.id)}/posts/${encodeURIComponent(activeDraftId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: newPostContent.trim(), mode: "draft" }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Failed to save draft");
        }
      } else {
        const res = await fetch(`/api/circles/${encodeURIComponent(circle.id)}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newPostContent.trim(), mode: "draft" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Failed to save draft");
        }
        const data = (await res.json()) as { post: { id: string } };
        setActiveDraftId(data.post.id);
      }
      setPostSuccessMessage("Draft saved.");
      void loadDrafts(circle.id);
    } catch (err) {
      setPostError((err as Error).message);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!circle || !newPostContent.trim() || !scheduleAt || submittingPost) return;
    setSubmittingPost(true);
    setPostError(null);
    setPostSuccessMessage(null);
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circle.id)}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newPostContent.trim(),
          mode: "schedule",
          scheduled_for: new Date(scheduleAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to schedule post");
      }
      setPostSuccessMessage("Post scheduled.");
      setNewPostContent("");
      setScheduleAt("");
      setActiveDraftId(null);
      void loadDrafts(circle.id);
    } catch (err) {
      setPostError((err as Error).message);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeleteDraft = async (postId: string) => {
    if (!circle) return;
    try {
      const res = await fetch(
        `/api/circles/${encodeURIComponent(circle.id)}/posts/${encodeURIComponent(postId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to delete");
      }
      if (activeDraftId === postId) {
        setActiveDraftId(null);
        setNewPostContent("");
      }
      void loadDrafts(circle.id);
    } catch (err) {
      setPostError((err as Error).message);
    }
  };

  const handleLoadDraft = (post: { id: string; content: string }) => {
    setActiveDraftId(post.id);
    setNewPostContent(post.content);
    setPostSuccessMessage(null);
  };

  const handleSubmitPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circle || submittingPost) return;
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) return;
    setSubmittingPost(true);
    setPostError(null);
    setPostSuccessMessage(null);
    try {
      const res = await fetch(`/api/circles/${encodeURIComponent(circle.id)}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, options }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create poll");
      }
      const data = (await res.json()) as { content: CircleFeedItem | null; pending?: boolean };
      if (data.pending) {
        setPostSuccessMessage("Your poll has been submitted for approval.");
      } else if (data.content) {
        const c = data.content;
        setFeed((prev) => [
          { ...c, downvote_count: c.downvote_count ?? 0 },
          ...prev,
        ]);
        setPostSuccessMessage("Your poll has been published.");
      }
      setPollQuestion("");
      setPollOptions(["", ""]);
    } catch (err) {
      setPostError((err as Error).message);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleContentVote = async (contentId: string, direction: CircleVoteType) => {
    if (!userRole || votingContentId) return;
    setVotingContentId(contentId);
    try {
      const res = await fetch(`/api/circle-content/${encodeURIComponent(contentId)}/vote`, {
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
      setContentVoteById((prev) => {
        const next = { ...prev };
        if (data.my_vote) next[contentId] = data.my_vote;
        else delete next[contentId];
        return next;
      });
      setFeed((prev) =>
        prev.map((item) =>
          item.id === contentId
            ? {
                ...item,
                like_count: data.like_count,
                downvote_count: data.downvote_count,
              }
            : item
        )
      );
    } finally {
      setVotingContentId(null);
    }
  };

  const handlePin = async (contentId: string, currentlyPinned: boolean) => {
    if (!circle) return;
    setModeratingId(contentId);
    try {
      const res = await fetch(
        `/api/circles/${encodeURIComponent(circle.id)}/content/${encodeURIComponent(contentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_pinned: !currentlyPinned }),
        }
      );
      if (!res.ok) return;
      setFeed((prev) =>
        prev.map((item) =>
          item.id === contentId ? { ...item, is_pinned: !currentlyPinned } : item
        )
      );
    } finally {
      setModeratingId(null);
    }
  };

  const handleDeletePost = async (contentId: string) => {
    if (!circle || !confirm("Delete this post? This cannot be undone.")) return;
    setModeratingId(contentId);
    try {
      const res = await fetch(
        `/api/circles/${encodeURIComponent(circle.id)}/content/${encodeURIComponent(contentId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setFeed((prev) => prev.filter((item) => item.id !== contentId));
    } finally {
      setModeratingId(null);
    }
  };

  const handleApprove = async (contentId: string) => {
    if (!circle) return;
    setModeratingId(contentId);
    try {
      const res = await fetch(
        `/api/circles/${encodeURIComponent(circle.id)}/content/${encodeURIComponent(contentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_published: true }),
        }
      );
      if (!res.ok) return;
      setFeed((prev) =>
        prev.map((item) =>
          item.id === contentId ? { ...item, is_published: true } : item
        )
      );
    } finally {
      setModeratingId(null);
    }
  };

  const handleReportSubmit = async () => {
    if (!circle || !reportModal || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      if (reportModal.kind === "content") {
        const res = await fetch(`/api/circles/${encodeURIComponent(circle.id)}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reported_content_id: reportModal.contentId,
            reason: reportReason,
            description: reportDescription.trim() || undefined,
          }),
        });
        if (res.ok) {
          setReportModal(null);
          setReportReason("spam");
          setReportDescription("");
        }
      } else {
        const res = await fetch("/api/platform/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_type: "circle",
            reported_id: circle.id,
            reason: reportReason,
            description: reportDescription.trim() || undefined,
          }),
        });
        if (res.ok) {
          setReportModal(null);
          setReportReason("spam");
          setReportDescription("");
        }
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  const closeReportModal = () => {
    setReportModal(null);
    setReportReason("spam");
    setReportDescription("");
  };

  const guidelinesMarkdown =
    welcomePost?.content ||
    (circle as { settings?: { guidelines_markdown?: string } } | null)?.settings?.guidelines_markdown;
  const mustAckBeforePost =
    guidelinesAckRequired && !guidelinesAcked && userRole !== "owner" && userRole !== "moderator";

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (blockedFromCircle && !circle) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <Ban className="h-6 w-6 text-destructive" aria-hidden />
              </div>
              <h1 className="mt-4 text-2xl font-bold text-foreground">You&apos;re blocked from this circle</h1>
              <p className="mt-3 text-muted-foreground">
                The circle owner has removed your access. You can&apos;t view posts or participate here.
              </p>
            </div>
            <Link
              href={backToDirectoryHref}
              className="mt-6 inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Circle Directory
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (notFound || !circle) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-foreground">Circle not found</h1>
            <p className="mt-2 text-muted-foreground">
              This circle doesn&apos;t exist or isn&apos;t public.
            </p>
            <Link
              href={backToDirectoryHref}
              className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Circle Directory
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href={backToDirectoryHref}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Circle Directory
          </Link>

          {/* Circle header */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{circle.name}</h1>
                {circle.visibility === "public" && (
                  <div className="mt-2">
                    <PublicCircleBadge />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {userRole && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                    {userRole}
                  </span>
                )}
                {userRole && (
                  <button
                    type="button"
                    onClick={() => setReportModal({ kind: "circle", title: circle.name })}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Report circle to platform"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Report circle
                  </button>
                )}
                {circle.category && (
                  <span className="rounded-md bg-muted px-3 py-1 text-sm text-muted-foreground">
                    {circle.category.name}
                  </span>
                )}
              </div>
            </div>

            {circle.description && (
              <p className="mt-4 text-muted-foreground">{circle.description}</p>
            )}

            <CircleStats
              variant="header"
              members={circle.member_count}
              posts={circle.post_count}
              views={circle.total_view_count}
              upvotes={circle.total_like_count}
            />

            {circle.expert?.full_name && (
              <p className="mt-4 text-sm text-muted-foreground">
                by {circle.expert.full_name}
                {circle.expert.expertise && ` · ${circle.expert.expertise}`}
              </p>
            )}
          </div>

          {guidelinesMarkdown && (
            <section className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h2 className="text-sm font-semibold text-foreground">
                {welcomePost?.title?.trim() || "Guidelines"}
              </h2>
              <div className="mt-2 text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                <Markdown>{guidelinesMarkdown}</Markdown>
              </div>
              {userRole && guidelinesAckRequired && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Read guidelines before posting</p>
                    <p className="text-xs text-muted-foreground">
                      {guidelinesAcked
                        ? "You have acknowledged the current guidelines."
                        : "Please acknowledge these guidelines to unlock posting."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={acknowledgeGuidelines}
                    disabled={guidelinesAcked || guidelinesAckSaving || guidelinesAckLoading}
                    className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {guidelinesAcked ? "Acknowledged" : guidelinesAckSaving ? "Saving…" : "Read Guidelines"}
                  </button>
                </div>
              )}
            </section>
          )}

          <div className="mt-8 space-y-6">
            {blockedFromCircle ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <Ban className="h-6 w-6 text-destructive" aria-hidden />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-foreground">You&apos;re blocked from this circle</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  The circle owner has removed your access. Posts and participation are not available.
                </p>
              </div>
            ) : null}

            {!blockedFromCircle && canCompose && (
              <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    {composerMode === "post" ? "New Post" : "New Poll"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShareSource({ kind: "url" });
                        setShareModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Share a link
                    </button>
                  <div className="inline-flex overflow-hidden rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => setComposerMode("post")}
                      className={`px-3 py-1.5 text-sm ${
                        composerMode === "post"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      Post
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode("poll")}
                      className={`px-3 py-1.5 text-sm ${
                        composerMode === "poll"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      Poll
                    </button>
                  </div>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {composerMode === "post"
                    ? "Share an update, question, or resource with this circle."
                    : "Ask a question and let members vote."}
                </p>
                {mustAckBeforePost && (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    You need to read and acknowledge the guidelines above before posting.
                  </p>
                )}
                <form
                  onSubmit={composerMode === "post" ? handleSubmitPost : handleSubmitPoll}
                  className="mt-4 space-y-3"
                >
                  {composerMode === "post" ? (
                    <>
                      <CircleMarkdownEditor
                        value={newPostContent}
                        onChange={setNewPostContent}
                        placeholder="Write your post in Markdown…"
                        rows={4}
                        circleId={circle?.id}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPostPreview((p) => !p)}
                          className="text-sm text-primary hover:underline"
                        >
                          {showPostPreview ? "Hide preview" : "Preview"}
                        </button>
                        {activeDraftId ? (
                          <span className="text-xs text-muted-foreground">Auto-saves as you type</span>
                        ) : null}
                      </div>
                      {showPostPreview && newPostContent.trim() ? (
                        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                          <Markdown>{newPostContent}</Markdown>
                        </div>
                      ) : null}
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-muted-foreground">Schedule post (local time)</span>
                        <input
                          type="datetime-local"
                          value={scheduleAt}
                          onChange={(e) => setScheduleAt(e.target.value)}
                          className="max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </label>
                      {draftPosts.length > 0 ? (
                        <div className="rounded-md border border-dashed border-border p-3 text-sm">
                          <p className="font-medium text-foreground">Drafts &amp; scheduled</p>
                          <ul className="mt-2 space-y-2">
                            {draftPosts.map((d) => (
                              <li
                                key={d.id}
                                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                              >
                                <div>
                                  <p className="font-medium text-foreground">{d.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {d.publication_status === "scheduled" && d.scheduled_for
                                      ? `Scheduled ${new Date(d.scheduled_for).toLocaleString()}`
                                      : "Draft"}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="text-xs text-primary hover:underline"
                                    onClick={() => handleLoadDraft(d)}
                                  >
                                    Load
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-destructive hover:underline"
                                    onClick={() => void handleDeleteDraft(d.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <CircleMarkdownEditor
                        value={pollQuestion}
                        onChange={setPollQuestion}
                        placeholder="Poll question (Markdown supported)…"
                        rows={3}
                        circleId={circle?.id}
                      />
                      <div className="space-y-2">
                        {pollOptions.map((opt, idx) => (
                          <input
                            key={idx}
                            value={opt}
                            onChange={(e) =>
                              setPollOptions((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))
                            }
                            placeholder={`Option ${idx + 1}`}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        ))}
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setPollOptions((prev) => (prev.length >= 10 ? prev : [...prev, ""]))}
                            className="text-sm text-primary hover:underline disabled:opacity-50"
                            disabled={pollOptions.length >= 10}
                          >
                            Add option
                          </button>
                          <button
                            type="button"
                            onClick={() => setPollOptions((prev) => (prev.length <= 2 ? prev : prev.slice(0, -1)))}
                            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                            disabled={pollOptions.length <= 2}
                          >
                            Remove last
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {postError && (
                    <p className="text-sm text-destructive">{postError}</p>
                  )}
                  {postSuccessMessage && (
                    <p className="text-sm text-emerald-600">{postSuccessMessage}</p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    {composerMode === "post" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveDraft()}
                          disabled={submittingPost}
                          className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                        >
                          {submittingPost ? "Saving…" : "Save draft"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSchedulePost()}
                          disabled={
                            submittingPost ||
                            mustAckBeforePost ||
                            !newPostContent.trim() ||
                            !scheduleAt
                          }
                          className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                        >
                          Schedule
                        </button>
                      </>
                    ) : null}
                    <button
                      type="submit"
                      disabled={
                        submittingPost ||
                        mustAckBeforePost ||
                        (composerMode === "post"
                          ? !newPostContent.trim()
                          : !pollQuestion.trim() || pollOptions.filter((o) => o.trim().length > 0).length < 2)
                      }
                      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {submittingPost ? "Publishing…" : composerMode === "post" ? "Post" : "Publish poll"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Moderation queue banner — visible to moderators/owners when posts are pending */}
            {!blockedFromCircle && isModerator && pendingCount > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
                <span className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                  <Clock className="h-4 w-4" />
                  {pendingCount} post{pendingCount === 1 ? "" : "s"} awaiting approval
                </span>
                {circle && (
                  <a
                    href={`/dashboard/circles/${circle.id}/moderation`}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
                  >
                    <Shield className="h-3 w-3" />
                    Review queue
                  </a>
                )}
              </div>
            )}

            {/* Feed */}
            {!blockedFromCircle && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">Feed</h2>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="sr-only">Sort feed</span>
                  <span aria-hidden>Sort</span>
                  <select
                    value={feedSort}
                    onChange={(e) => {
                      const v = e.target.value as FeedSortMode;
                      setFeedSort(v);
                      if (circle) void loadPosts(circle.id, v);
                    }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                  >
                    <option value="recent">Recent</option>
                    <option value="top">Most upvoted</option>
                    <option value="controversial">Controversial</option>
                  </select>
                </label>
              </div>
              {loadingPosts ? (
                <p className="mt-3 text-sm text-muted-foreground">Loading posts…</p>
              ) : postError && feed.length === 0 ? (
                <p className="mt-3 text-sm text-destructive">{postError}</p>
              ) : feed.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing yet. Be the first to post or create a poll.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {feed.map((item) => {
                    if (item.content_type === "poll" && item.poll) {
                      const pollMyVote = contentVoteById[item.id];
                      const pollUp = pollMyVote === "up";
                      const pollDown = pollMyVote === "down";
                      const pollDv = item.downvote_count ?? 0;
                      return (
                        <div key={item.id} className="relative">
                          <CirclePollCard poll={item.poll} />
                          {userRole && (
                            <button
                              type="button"
                              onClick={() =>
                                setReportModal({
                                  kind: "content",
                                  contentId: item.id,
                                  title: item.poll?.question ?? "Poll",
                                })
                              }
                              className="absolute top-2 right-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Report poll"
                            >
                              <Flag className="h-3.5 w-3.5" />
                              Report
                            </button>
                          )}
                          <div className="mt-2 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-2">
                            {userRole && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleContentVote(item.id, "up")}
                                  disabled={votingContentId === item.id}
                                  className={`inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                                    pollUp
                                      ? "font-medium text-primary"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  aria-label={pollUp ? "Remove upvote" : "Upvote"}
                                >
                                  <ThumbsUp className={`h-3.5 w-3.5 ${pollUp ? "fill-current" : ""}`} />
                                  {item.like_count}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleContentVote(item.id, "down")}
                                  disabled={votingContentId === item.id}
                                  className={`inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                                    pollDown
                                      ? "font-medium text-destructive"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  aria-label={pollDown ? "Remove downvote" : "Downvote"}
                                >
                                  <ThumbsDown className={`h-3.5 w-3.5 ${pollDown ? "fill-current" : ""}`} />
                                  {pollDv}
                                </button>
                              </>
                            )}
                            {!userRole && (
                              <span className="text-xs text-muted-foreground">
                                {item.like_count} up · {pollDv} down
                              </span>
                            )}
                          </div>
                          {isModerator && (
                            <ModeratorActions
                              isPinned={item.is_pinned}
                              isPublished={item.is_published}
                              isLoading={moderatingId === item.id}
                              onPin={() => handlePin(item.id, item.is_pinned)}
                              onDelete={() => handleDeletePost(item.id)}
                              onApprove={() => handleApprove(item.id)}
                            />
                          )}
                        </div>
                      );
                    }
                    const myVote = contentVoteById[item.id];
                    const isUpvoted = myVote === "up";
                    const isDownvoted = myVote === "down";
                    const downvoteCount = item.downvote_count ?? 0;
                    return (
                      <article
                        key={item.id}
                        className={`rounded-lg border bg-card p-4 shadow-sm ${
                          item.is_pinned ? "border-primary/40" : "border-border"
                        }`}
                      >
                        {item.is_pinned && (
                          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-primary">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </div>
                        )}
                        <SharedContentBanner
                          sharedFrom={item.shared_from}
                          sharerName={
                            item.sharer?.full_name || item.author.full_name || undefined
                          }
                        />
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-semibold text-foreground">
                            <Link
                              href={`/circles/${encodeURIComponent(slug)}/posts/${encodeURIComponent(item.id)}`}
                              className="hover:underline"
                            >
                              {item.title}
                            </Link>
                          </h3>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="prose prose-sm mt-2 max-w-none dark:prose-invert">
                          <Markdown>{item.content}</Markdown>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {item.shared_from ? "Shared by" : "Posted by"}{" "}
                            {item.author.full_name || "Member"}
                          </span>
                          <div className="flex items-center gap-3">
                            {userRole && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleContentVote(item.id, "up")}
                                  disabled={votingContentId === item.id}
                                  className={`inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                                    isUpvoted
                                      ? "font-medium text-primary"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  aria-label={isUpvoted ? "Remove upvote" : "Upvote"}
                                >
                                  <ThumbsUp className={`h-3.5 w-3.5 ${isUpvoted ? "fill-current" : ""}`} />
                                  {item.like_count}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleContentVote(item.id, "down")}
                                  disabled={votingContentId === item.id}
                                  className={`inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
                                    isDownvoted
                                      ? "font-medium text-destructive"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  aria-label={isDownvoted ? "Remove downvote" : "Downvote"}
                                >
                                  <ThumbsDown className={`h-3.5 w-3.5 ${isDownvoted ? "fill-current" : ""}`} />
                                  {downvoteCount}
                                </button>
                              </>
                            )}
                            {!userRole && (
                              <span className="text-xs text-muted-foreground">
                                {item.like_count} up · {downvoteCount} down
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {item.comment_count} comments
                            </span>
                            {userRole && (
                              <ShareToCircleTrigger
                                onClick={() => {
                                  setShareSource({ kind: "circle_content", contentId: item.id });
                                  setShareModalOpen(true);
                                }}
                              />
                            )}
                            {userRole && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReportModal({
                                    kind: "content",
                                    contentId: item.id,
                                    title: item.title,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                aria-label="Report post"
                              >
                                <Flag className="h-3.5 w-3.5" />
                                Report
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Moderator controls */}
                        {isModerator && (
                          <ModeratorActions
                            isPinned={item.is_pinned}
                            isPublished={item.is_published}
                            isLoading={moderatingId === item.id}
                            onPin={() => handlePin(item.id, item.is_pinned)}
                            onDelete={() => handleDeletePost(item.id)}
                            onApprove={() => handleApprove(item.id)}
                          />
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            )}
          </div>
        </div>

        <ShareToCircleModal
          open={shareModalOpen}
          onOpenChange={(o) => {
            setShareModalOpen(o);
            if (!o) setShareSource(null);
          }}
          source={shareSource}
          excludeCircleId={circle?.id}
          onSuccess={() => {
            if (circle) void loadPosts(circle.id, feedSort);
            setPostSuccessMessage("Shared successfully.");
          }}
        />

        {reportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground">
                {reportModal.kind === "circle" ? "Report circle" : "Report content"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                &ldquo;{reportModal.title}&rdquo;
                {reportModal.kind === "circle"
                  ? " — this goes to platform administrators."
                  : " — circle moderators will review."}
              </p>
              <label htmlFor="report-reason" className="mt-4 block text-sm font-medium text-foreground">
                Reason
              </label>
              <select
                id="report-reason"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportReason)}
              >
                {REPORT_REASON_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {REPORT_REASON_LABELS[v]}
                  </option>
                ))}
              </select>
              <label htmlFor="report-description" className="mt-3 block text-sm font-medium text-foreground">
                Details (optional)
              </label>
              <textarea
                id="report-description"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                maxLength={MAX_REPORT_DESCRIPTION_LENGTH}
                placeholder="Add context for moderators…"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReportModal}
                  className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReportSubmit}
                  disabled={reportSubmitting}
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {reportSubmitting ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function ModeratorActions({
  isPinned,
  isPublished,
  isLoading,
  onPin,
  onDelete,
  onApprove,
}: {
  isPinned: boolean;
  isPublished: boolean;
  isLoading: boolean;
  onPin: () => void;
  onDelete: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
      <span className="text-xs text-muted-foreground">Mod:</span>
      <button
        type="button"
        onClick={onPin}
        disabled={isLoading}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        title={isPinned ? "Unpin" : "Pin"}
      >
        <Pin className="h-3 w-3" />
        {isPinned ? "Unpin" : "Pin"}
      </button>
      {!isPublished && (
        <button
          type="button"
          onClick={onApprove}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
          title="Approve"
        >
          <CheckCircle className="h-3 w-3" />
          Approve
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={isLoading}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
        title="Delete post"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </div>
  );
}
