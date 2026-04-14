"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CircleCategory } from "@/types/circles";
import type {
  CircleAccessType,
  CircleVisibility,
  WhoCanInvite,
  WhoCanPost,
  WhoCanShare,
} from "@/types/circles";
import type { Circle } from "@/types/circles";
import { ArrowLeft, BarChart3, Bell, Save, Shield, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CircleMarkdownEditor } from "@/components/circles/CircleMarkdownEditor";
import { CircleStats } from "@/components/circles/CircleStats";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CircleContentStats = {
  post_count: number;
  total_view_count: number;
  total_like_count: number;
};

export default function EditCirclePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [circle, setCircle] = useState<Circle | null>(null);
  const [categories, setCategories] = useState<CircleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CircleVisibility>("private");
  const [categoryId, setCategoryId] = useState<string>("");
  const [accessType, setAccessType] = useState<CircleAccessType>("free");
  const [whoCanInvite, setWhoCanInvite] = useState<WhoCanInvite>("moderators_only");
  const [whoCanPost, setWhoCanPost] = useState<WhoCanPost>("moderators_only");
  const [whoCanShare, setWhoCanShare] = useState<WhoCanShare>("same_as_post");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifyPosts, setNotifyPosts] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyMembership, setNotifyMembership] = useState(false);
  const [notifyReactions, setNotifyReactions] = useState(false);
  const [guidelinesMarkdown, setGuidelinesMarkdown] = useState("");
  const [requireGuidelinesAck, setRequireGuidelinesAck] = useState(false);
  const [welcomeUpdatedAt, setWelcomeUpdatedAt] = useState<string | null>(null);
  const [contentStats, setContentStats] = useState<CircleContentStats | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/circles/${id}`).then((r) => (r.ok ? r.json() : { circle: null })),
      fetch("/api/circles/categories").then((r) => r.json()),
      fetch(`/api/circles/${id}/notifications`).then((r) =>
        r.ok ? r.json() : { settings: null }
      ),
      fetch(`/api/circles/${id}/welcome`).then((r) =>
        r.ok ? r.json() : { welcome_post: null }
      ),
    ]).then(([circleData, catData, notifData, welcomeData]) => {
      const payload = circleData as {
        circle: Circle | null;
        content_stats?: CircleContentStats;
        is_owner?: boolean;
      };
      const c = payload.circle;
      setContentStats(payload.content_stats ?? null);
      setIsOwner(payload.is_owner === true);
      setCircle(c);
      setCategories(catData.categories ?? []);
      if (c) {
        setName(c.name);
        setSlug(c.slug);
        setDescription(c.description ?? "");
        setVisibility(c.visibility);
        setCategoryId(c.category_id ?? "");
        setAccessType(c.access_type);
        setWhoCanInvite(c.settings?.who_can_invite ?? "moderators_only");
        const existingWhoCanPost = c.settings?.who_can_post as WhoCanPost | undefined;
        if (existingWhoCanPost) {
          setWhoCanPost(existingWhoCanPost);
        } else {
          // Derive a sensible default from legacy allow_member_posts
          setWhoCanPost(c.settings?.allow_member_posts ? "all_members" : "owners_only");
        }
        setRequiresApproval(c.settings?.requires_approval ?? false);
        setGuidelinesMarkdown(c.settings?.guidelines_markdown ?? "");
        setRequireGuidelinesAck(c.settings?.require_guidelines_ack ?? false);
        setWhoCanShare((c.settings?.who_can_share as WhoCanShare | undefined) ?? "same_as_post");
      }
      const settings = notifData.settings as
        | {
            notify_posts: boolean;
            notify_comments: boolean;
            notify_mentions: boolean;
            notify_membership: boolean;
            notify_reactions: boolean;
          }
        | null;
      if (settings) {
        setNotifyPosts(settings.notify_posts);
        setNotifyComments(settings.notify_comments);
        setNotifyMentions(settings.notify_mentions);
        setNotifyMembership(settings.notify_membership);
        setNotifyReactions(settings.notify_reactions);
      }
      const welcome = (welcomeData as { welcome_post?: { content?: string; updated_at?: string } | null })
        ?.welcome_post;
      if (welcome?.content?.trim()) {
        setGuidelinesMarkdown(welcome.content.trim());
      }
      setWelcomeUpdatedAt(welcome?.updated_at ?? null);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSaveNotificationPrefs = async () => {
    if (!id) return;
    setNotifLoading(true);
    try {
      const res = await fetch(`/api/circles/${id}/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify_posts: notifyPosts,
          notify_comments: notifyComments,
          notify_mentions: notifyMentions,
          notify_membership: notifyMembership,
          notify_reactions: notifyReactions,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update notification preferences");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }
    if (visibility === "public" && !categoryId) {
      setError("Public circles must have a category");
      return;
    }
    const trimmedGuidelines = guidelinesMarkdown.trim();
    if (requireGuidelinesAck && !trimmedGuidelines) {
      setError("Guidelines acknowledgment requires a welcome post. Add welcome content or disable the requirement.");
      return;
    }
    setSaving(true);
    try {
      // Save/remove welcome first, then persist settings, to avoid enabling ack on empty welcome.
      if (trimmedGuidelines) {
        const welcomeRes = await fetch(`/api/circles/${id}/welcome`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Welcome", content: trimmedGuidelines }),
        });
        if (!welcomeRes.ok) {
          const w = await welcomeRes.json().catch(() => ({}));
          setError(w.error || "Failed to save welcome post");
          return;
        }
      } else {
        const removeRes = await fetch(`/api/circles/${id}/welcome`, { method: "DELETE" });
        if (!removeRes.ok) {
          const w = await removeRes.json().catch(() => ({}));
          setError(w.error || "Failed to remove welcome post");
          return;
        }
      }

      const res = await fetch(`/api/circles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          visibility,
          category_id: visibility === "public" ? categoryId || undefined : undefined,
          access_type: accessType,
          settings: {
            ...(circle?.settings ?? {}),
            who_can_invite: whoCanInvite,
            who_can_post: whoCanPost,
            who_can_share: whoCanShare,
            // keep legacy flag in sync for older logic
            allow_member_posts: whoCanPost === "all_members",
            requires_approval: whoCanPost === "all_members" ? requiresApproval : false,
            require_guidelines_ack: requireGuidelinesAck,
            guidelines_markdown: trimmedGuidelines || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update circle");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    setLifecycleBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to archive");
        return;
      }
      setCircle(data.circle as Circle);
      setArchiveOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleUnarchive = async () => {
    if (!id) return;
    setLifecycleBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${id}/unarchive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to restore circle");
        return;
      }
      setCircle(data.circle as Circle);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setLifecycleBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          confirm_circle_name: deleteNameInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete");
        return;
      }
      setDeleteOpen(false);
      setDeleteNameInput("");
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLifecycleBusy(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }

  if (!circle) {
    return (
      <DashboardLayout>
        <div className="p-4">
          <p className="text-destructive">Circle not found or you don’t have access.</p>
          <Button variant="link" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!isOwner) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl p-4">
          <p className="text-muted-foreground">Only the circle owner can change settings.</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link href={`/circles/${circle.slug}`}>Back to circle</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const lifecycleStatus = circle.status ?? "active";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Circle</h1>
            <p className="text-sm text-muted-foreground">
              Update visibility and category for the directory.
              {lifecycleStatus === "archived" && (
                <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                  Archived — hidden from directory; members retain access
                </span>
              )}
              {lifecycleStatus === "deleted" && (
                <span className="ml-2 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                  Deleted — only you can view settings here
                </span>
              )}
            </p>
          </div>
        </div>

        {lifecycleStatus === "deleted" && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
            This circle is soft-deleted. Members no longer have access. Contact support if you need a hard
            purge or recovery.
          </p>
        )}

        {contentStats != null && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Public activity</CardTitle>
              <CardDescription>
                Totals from feed content (same semantics as the public circle page).{" "}
                <Link
                  href={`/dashboard/circles/${id}/analytics`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  View analytics
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CircleStats
                variant="header"
                className="mt-0"
                members={circle.member_count}
                posts={contentStats.post_count}
                views={contentStats.total_view_count}
                upvotes={contentStats.total_like_count}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Circle details</CardTitle>
            <CardDescription>Name, slug, and visibility.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. React Developers"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. react-developers"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this circle is about…"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as CircleVisibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (only members can find it)</SelectItem>
                    <SelectItem value="public">Public (listed in Circle Directory)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {visibility === "public" && (
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={categoryId} onValueChange={setCategoryId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Access type</Label>
                <Select
                  value={accessType}
                  onValueChange={(v) => setAccessType(v as CircleAccessType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (anyone can join)</SelectItem>
                    <SelectItem value="subscription">Subscription (platform subscribers)</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Who can invite members</Label>
                <Select
                  value={whoCanInvite}
                  onValueChange={(v) => setWhoCanInvite(v as WhoCanInvite)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owners_only">Owners only</SelectItem>
                    <SelectItem value="moderators_only">Moderators only</SelectItem>
                    <SelectItem value="all_members">All members</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Who can post</Label>
                <Select
                  value={whoCanPost}
                  onValueChange={(v) => {
                    setWhoCanPost(v as WhoCanPost);
                    // Clear approval requirement when members can no longer post
                    if (v !== "all_members") setRequiresApproval(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owners_only">Owners only</SelectItem>
                    <SelectItem value="moderators_only">Moderators and owner</SelectItem>
                    <SelectItem value="all_members">All members</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Controls which roles (owner, moderators, members) are allowed to create posts in
                  this circle.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Who can share into this circle</Label>
                <Select
                  value={whoCanShare}
                  onValueChange={(v) => setWhoCanShare(v as WhoCanShare)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same_as_post">Same as posting rules</SelectItem>
                    <SelectItem value="all_members">All active members</SelectItem>
                    <SelectItem value="moderators_only">Moderators and owner only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Share-to-Circle creates a post with attribution. This controls who may share feed
                  posts or external links here.
                </p>
              </div>
              {whoCanPost === "all_members" && (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Require approval for member posts</p>
                    <p className="text-xs text-muted-foreground">
                      When enabled, posts from regular members are held for moderator review before
                      appearing in the feed. Moderators and owners always post immediately.
                    </p>
                  </div>
                  <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/dashboard/circles/${id}/members`}>
                    <Users className="mr-2 h-4 w-4" />
                    Members
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/dashboard/circles/${id}/moderation`}>
                    <Shield className="mr-2 h-4 w-4" />
                    Moderation queue
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/dashboard/circles/${id}/analytics`}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analytics
                  </Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Welcome post and guidelines</CardTitle>
            <CardDescription>
              Markdown welcome content shown at the top of the circle feed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CircleMarkdownEditor
              value={guidelinesMarkdown}
              onChange={setGuidelinesMarkdown}
              placeholder="e.g. Be respectful. No spam. Introduce yourself in your first post."
              rows={5}
              circleId={id}
            />
            <div className="mt-3 flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Require members to read guidelines before posting</p>
                <p className="text-xs text-muted-foreground">
                  When enabled, members must check the acknowledgment on the Circle page before posting.
                </p>
              </div>
              <Switch checked={requireGuidelinesAck} onCheckedChange={setRequireGuidelinesAck} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Saved as a dedicated welcome post when you click Save changes.
              {welcomeUpdatedAt ? ` Last updated ${new Date(welcomeUpdatedAt).toLocaleString()}.` : ""}
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  const form = document.querySelector("form");
                  form?.requestSubmit();
                }}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Circle notifications
              </CardTitle>
              <CardDescription>
                Control which activity from this circle generates notifications for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Global notification settings still control channels (in-app, email, push). These
                toggles affect which Circle events are created for you.
              </p>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Posts</p>
                  <p className="text-xs text-muted-foreground">
                    New posts published in this circle.
                  </p>
                </div>
                <Switch checked={notifyPosts} onCheckedChange={setNotifyPosts} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Comments</p>
                  <p className="text-xs text-muted-foreground">
                    New comments on your posts.
                  </p>
                </div>
                <Switch checked={notifyComments} onCheckedChange={setNotifyComments} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Mentions</p>
                  <p className="text-xs text-muted-foreground">
                    When someone @mentions you in this circle.
                  </p>
                </div>
                <Switch checked={notifyMentions} onCheckedChange={setNotifyMentions} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Membership changes</p>
                  <p className="text-xs text-muted-foreground">
                    Member joins and role changes (for owners and moderators).
                  </p>
                </div>
                <Switch checked={notifyMembership} onCheckedChange={setNotifyMembership} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Reactions</p>
                  <p className="text-xs text-muted-foreground">
                    Reactions and upvotes on your posts and comments.
                  </p>
                </div>
                <Switch checked={notifyReactions} onCheckedChange={setNotifyReactions} />
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveNotificationPrefs}
                  disabled={notifLoading}
                >
                  {notifLoading ? "Saving…" : "Save notification preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Archive or delete</CardTitle>
              <CardDescription>
                Archiving hides the circle from the directory and blocks new joins. Current members keep access.
                Deleting revokes access for members (owner can still view settings here).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {lifecycleStatus === "active" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setArchiveOpen(true)}
                  disabled={lifecycleBusy}
                >
                  Archive circle
                </Button>
              )}
              {lifecycleStatus === "archived" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleUnarchive()}
                  disabled={lifecycleBusy}
                >
                  Restore to directory
                </Button>
              )}
              {lifecycleStatus !== "deleted" && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteNameInput("");
                    setDeleteOpen(true);
                  }}
                  disabled={lifecycleBusy}
                >
                  Delete circle…
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this circle?</AlertDialogTitle>
              <AlertDialogDescription>
                It will disappear from the public directory and new people cannot join. Current members keep access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleArchive();
                }}
                disabled={lifecycleBusy}
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this circle?</AlertDialogTitle>
              <AlertDialogDescription>
                This soft-deletes the circle. Type the exact circle name to confirm: <strong>{name}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteNameInput}
              onChange={(e) => setDeleteNameInput(e.target.value)}
              placeholder="Circle name"
              className="mt-2"
              autoComplete="off"
            />
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  void handleDelete();
                }}
                disabled={lifecycleBusy || deleteNameInput.trim() !== name.trim()}
              >
                Delete circle
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
