"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { ArrowLeft, Users, Loader2, UserPlus, Mail, RefreshCw, X, History, Ban, UserX } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getAvatarUrl } from "@/lib/utils/avatar";
import { useToast } from "@/components/ui/Toasts/use-toast";
import type { Circle } from "@/types/circles";
import type { CircleMemberRole } from "@/types/circles";
import type { PendingInvitation } from "@/types/circles";

type RoleAuditEntry = {
  id: string;
  old_role: CircleMemberRole;
  new_role: CircleMemberRole;
  created_at: string;
  user: { id: string; full_name: string; avatar_url: string | null };
  changed_by: { id: string; full_name: string; avatar_url: string | null };
};

type MemberWithRole = {
  id: string;
  circle_id: string;
  user_id: string | null;
  role: CircleMemberRole | "owner";
  membership_type: string;
  status: string;
  joined_at: string;
  profile: { id: string; full_name: string; avatar_url?: string; expertise?: string };
};

export default function CircleMembersPage() {
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();
  const [circle, setCircle] = useState<Circle | null>(null);
  const [canInvite, setCanInvite] = useState(false);
  const [members, setMembers] = useState<MemberWithRole[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [membersForbidden, setMembersForbidden] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteExpiresDays, setInviteExpiresDays] = useState<number | "">("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; email: string } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<RoleAuditEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogVisible, setAuditLogVisible] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; user_id: string; created_at: string }>>([]);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [blockConfirmTarget, setBlockConfirmTarget] = useState<{ user_id: string; name: string } | null>(null);

  const fetchCircle = useCallback(async () => {
    if (!id) return null;
    const res = await fetch(`/api/circles/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    setCanInvite(!!data.can_invite);
    return data.circle as Circle;
  }, [id]);

  const fetchMembers = useCallback(async () => {
    if (!id) return [];
    const res = await fetch(`/api/circles/${id}/members`);
    if (res.status === 403) {
      setMembersForbidden(true);
      return [];
    }
    setMembersForbidden(false);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.members ?? []) as MemberWithRole[];
  }, [id]);

  const fetchInvitations = useCallback(async () => {
    if (!id) return [];
    const res = await fetch(`/api/circles/${id}/invitations`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.invitations ?? []) as PendingInvitation[];
  }, [id]);

  const fetchBlocked = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/circles/${id}/blocked`);
    if (!res.ok) return;
    const data = await res.json();
    setBlockedUsers(data.blocked ?? []);
  }, [id]);

  const handleLoadAuditLog = useCallback(async () => {
    if (!id) return;
    setAuditLogLoading(true);
    try {
      const res = await fetch(`/api/circles/${id}/role-audit`);
      if (!res.ok) return;
      const data = await res.json();
      setAuditLog((data.entries ?? []) as RoleAuditEntry[]);
      setAuditLogVisible(true);
    } finally {
      setAuditLogLoading(false);
    }
  }, [id]);

  const handleBlock = useCallback(
    async (userId: string) => {
      if (!id || blockingId) return;
      setBlockConfirmTarget(null);
      setBlockingId(userId);
      try {
        const res = await fetch(`/api/circles/${id}/blocked`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({ title: data?.error ?? "Failed to block user", variant: "destructive" });
          return;
        }
        setMembers((prev) => prev.filter((m) => m.user_id !== userId));
        await fetchBlocked();
        toast({ title: "User blocked" });
      } finally {
        setBlockingId(null);
      }
    },
    [id, blockingId, fetchBlocked, toast]
  );

  const handleUnblock = useCallback(
    async (userId: string) => {
      if (!id || unblockingId) return;
      setUnblockingId(userId);
      try {
        const res = await fetch(`/api/circles/${id}/blocked/${userId}`, { method: "DELETE" });
        if (!res.ok) {
          toast({ title: "Failed to unblock", variant: "destructive" });
          return;
        }
        setBlockedUsers((prev) => prev.filter((b) => b.user_id !== userId));
        toast({ title: "User unblocked" });
      } finally {
        setUnblockingId(null);
      }
    },
    [id, unblockingId]
  );

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    void (async () => {
      const res = await supabase.auth.getUser();
      const user = res.data.user;
      if (user) setCurrentUserId(user.id);
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchCircle(), fetchMembers(), fetchInvitations()])
      .then(([c, m, inv]) => {
        if (cancelled) return;
        setCircle(c ?? null);
        setMembers(m ?? []);
        setPendingInvitations(inv ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, fetchCircle, fetchMembers, fetchInvitations]);

  useEffect(() => {
    if (!id || !circle || !currentUserId) return;
    const isCircleOwner = circle.expert_id === currentUserId;
    const isCircleModerator =
      !isCircleOwner &&
      members.some(
        (m) => m.user_id === currentUserId && m.role === "moderator"
      );
    if (!isCircleOwner && !isCircleModerator) return;
    void fetchBlocked();
  }, [id, circle, currentUserId, members, fetchBlocked]);

  const currentUserRole: (CircleMemberRole | "owner") | null =
    circle && currentUserId
      ? circle.expert_id === currentUserId
        ? "owner"
        : (members.find((m) => m.user_id === currentUserId)?.role ?? null)
      : null;

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const emails = inviteEmails.map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      toast({ title: "Please enter at least one email", variant: "destructive" });
      return;
    }
    setInviteSubmitting(true);
    try {
      const res = await fetch(`/api/circles/${id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          message: inviteMessage.trim() || undefined,
          expires_in_days: inviteExpiresDays === "" ? undefined : Number(inviteExpiresDays),
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        toast({ title: data.error ?? "Too many requests", variant: "destructive" });
        return;
      }
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to send invitations", variant: "destructive" });
        return;
      }
      const successCount = data.invitations?.filter((i: { success: boolean }) => i.success).length ?? 0;
      toast({ title: `${successCount} invitation(s) sent` });
      setInviteOpen(false);
      setInviteEmails([""]);
      setInviteMessage("");
      setInviteExpiresDays("");
      const inv = await fetchInvitations();
      setPendingInvitations(inv);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleResend = async (membershipId: string) => {
    if (!id) return;
    setResendingId(membershipId);
    try {
      const res = await fetch(`/api/circles/${id}/invitations/${membershipId}/resend`, { method: "POST" });
      const data = await res.json();
      if (res.status === 429) {
        toast({ title: data.error ?? "Too many resends", variant: "destructive" });
        return;
      }
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to resend", variant: "destructive" });
        return;
      }
      toast({ title: "Invitation resent" });
      const inv = await fetchInvitations();
      setPendingInvitations(inv);
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async () => {
    if (!id || !revokeTarget) return;
    const res = await fetch(`/api/circles/${id}/invitations/${revokeTarget.id}/revoke`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      toast({ title: data.error ?? "Failed to revoke", variant: "destructive" });
      return;
    }
    toast({ title: "Invitation revoked" });
    setRevokeTarget(null);
    const inv = await fetchInvitations();
    setPendingInvitations(inv);
  };

  const isOwner = currentUserRole === "owner";
  const isModerator = currentUserRole === "moderator";
  const showMemberActions = isOwner || isModerator;
  const canManageBlocked = isOwner || isModerator;
  const canViewMembers = !membersForbidden;

  const moderatorCanBlockMemberRow = (member: MemberWithRole) => {
    if (!isModerator || !currentUserId || !member.user_id) return false;
    if (member.user_id === currentUserId) return false;
    if (member.role === "owner") return false;
    if (member.id.startsWith("owner-")) return false;
    if (member.role === "moderator") return false;
    if (circle?.expert_id && member.user_id === circle.expert_id) return false;
    return true;
  };

  const handleRoleChange = async (membershipId: string, newRole: CircleMemberRole) => {
    if (!id || !isOwner || membershipId.startsWith("owner-")) return;
    setChangingRoleId(membershipId);
    try {
      const res = await fetch(`/api/circles/${id}/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to update role");
        return;
      }
      const listRes = await fetch(`/api/circles/${id}/members`);
      if (listRes.ok) {
        const data = await listRes.json();
        setMembers(data.members ?? []);
      }
    } finally {
      setChangingRoleId(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const roleBadge: Record<string, { label: string; className: string }> = {
    owner: { label: "Owner", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    moderator: { label: "Moderator", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
    contributor: { label: "Contributor", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    member: { label: "Member", className: "bg-muted text-muted-foreground" },
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl p-4">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Members
            </h1>
            <p className="text-sm text-muted-foreground">
              {circle.name} — {canViewMembers ? `${members.length} member${members.length !== 1 ? "s" : ""}` : "member list hidden"}
            </p>
          </div>
          {canInvite && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0 sm:ml-auto">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Members
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite by email</DialogTitle>
                  <DialogDescription>Add one or more email addresses. They will receive an invitation link.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email(s)</Label>
                    {inviteEmails.map((email, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={email}
                          onChange={(e) => {
                            const next = [...inviteEmails];
                            next[i] = e.target.value;
                            setInviteEmails(next);
                          }}
                        />
                        {inviteEmails.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setInviteEmails(inviteEmails.filter((_, j) => j !== i))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInviteEmails([...inviteEmails, ""])}
                    >
                      Add another
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Message (optional)</Label>
                    <Textarea
                      placeholder="Personal message for the invitation"
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expires in (optional)</Label>
                    <Select
                      value={inviteExpiresDays === "" ? "none" : String(inviteExpiresDays)}
                      onValueChange={(v) => setInviteExpiresDays(v === "none" ? "" : Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No expiration</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteSubmitting}>
                      {inviteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                      Send invitations
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {!canViewMembers && (
          <div className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {canInvite ? (
              <>
                You can invite people to this circle, but you don&apos;t have permission to view the full member list.
                Use the <span className="font-medium text-foreground">Invite Members</span> button above.
              </>
            ) : (
              <>
                You don&apos;t have permission to view the full member list. Only moderators and the circle owner
                can see all members here unless the circle enables a visible member list.
              </>
            )}
          </div>
        )}

        {pendingInvitations.length > 0 && (canInvite || isOwner) && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Pending invitations</CardTitle>
              <CardDescription>Invitations sent; awaiting acceptance. You can resend or revoke.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-sm font-medium">Email</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Sent</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Expires</th>
                      {(canInvite || isOwner) && (
                        <th className="px-4 py-2 text-right text-sm font-medium">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-border">
                        <td className="px-4 py-2">{inv.invited_email}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {formatDate(inv.invitation_sent_at)}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {inv.invitation_expires_at ? formatDate(inv.invitation_expires_at) : "—"}
                        </td>
                        {(canInvite || isOwner) && (
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={resendingId === inv.id}
                              onClick={() => handleResend(inv.id)}
                            >
                              {resendingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setRevokeTarget({ id: inv.id, email: inv.invited_email })}
                            >
                              Revoke
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
              <AlertDialogDescription>
                {revokeTarget ? `The invitation sent to ${revokeTarget.email} will be invalidated. They will no longer be able to join with that link.` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!blockConfirmTarget} onOpenChange={(open) => !open && setBlockConfirmTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Block member?</AlertDialogTitle>
              <AlertDialogDescription>
                {blockConfirmTarget
                  ? `${blockConfirmTarget.name} will be blocked from this circle. They will not be able to view the circle or participate. You can unblock them later from the Blocked users list.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => blockConfirmTarget && handleBlock(blockConfirmTarget.user_id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Block
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card>
          <CardHeader>
            <CardTitle>Member list</CardTitle>
            <CardDescription>
              View roles and manage member roles. Only the circle owner can change roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold">Member</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Joined</th>
                    {showMemberActions && (
                      <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={showMemberActions ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                        No members found
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => {
                      const badge = roleBadge[member.role] ?? roleBadge.member;
                      const displayName = member.profile?.full_name?.trim() || "Unknown";
                      const avatarUrl = getAvatarUrl(member.profile?.avatar_url);
                      const isOwnerRow = member.role === "owner";
                      const canChangeRole = isOwner && !isOwnerRow && !member.id.startsWith("owner-");
                      const showBlockForRow =
                        member.user_id &&
                        ((isOwner && canChangeRole) || moderatorCanBlockMemberRow(member));

                      return (
                        <tr
                          key={member.id}
                          className="border-b border-border hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {avatarUrl ? (
                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border">
                                  <Image
                                    src={avatarUrl}
                                    alt={displayName}
                                    fill
                                    className="object-cover"
                                    unoptimized={
                                      avatarUrl.includes("127.0.0.1") ||
                                      avatarUrl.includes("localhost") ||
                                      avatarUrl.includes("supabase")
                                    }
                                  />
                                </div>
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-sm font-medium text-primary">
                                  {displayName[0]?.toUpperCase() ?? "?"}
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{displayName}</div>
                                {member.profile?.expertise && (
                                  <div className="text-xs text-muted-foreground">{member.profile.expertise}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(member.joined_at)}
                          </td>
                          {showMemberActions && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {canChangeRole ? (
                                  <Select
                                    value={member.role as string}
                                    onValueChange={(v) => handleRoleChange(member.id, v as CircleMemberRole)}
                                    disabled={changingRoleId === member.id}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      {changingRoleId === member.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <SelectValue />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="member">Member</SelectItem>
                                      <SelectItem value="contributor">Contributor</SelectItem>
                                      <SelectItem value="moderator">Moderator</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : null}
                                {showBlockForRow ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:bg-destructive/10"
                                    disabled={blockingId !== null}
                                    onClick={() => {
                                      const uid = member.user_id;
                                      if (!uid) return;
                                      setBlockConfirmTarget({
                                        user_id: uid,
                                        name: member.profile?.full_name?.trim() || "This member",
                                      });
                                    }}
                                  >
                                    {blockingId === member.user_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Ban className="h-4 w-4" />
                                    )}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {canManageBlocked && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Blocked users
              </CardTitle>
              <CardDescription>
                Blocked users cannot access this circle. Unblock to allow them to rejoin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blocked users.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left font-semibold">User ID</th>
                        <th className="px-3 py-2 text-left font-semibold">Blocked at</th>
                        <th className="px-3 py-2 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedUsers.map((b) => (
                        <tr key={b.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {b.user_id.slice(0, 8)}…
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatDate(b.created_at)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={unblockingId === b.user_id}
                              onClick={() => handleUnblock(b.user_id)}
                            >
                              {unblockingId === b.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Unblock"
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Role change audit log — owner only */}
        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Role Change Audit Log
                  </CardTitle>
                  <CardDescription>
                    A record of all role changes made in this circle.
                  </CardDescription>
                </div>
                {!auditLogVisible && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadAuditLog}
                    disabled={auditLogLoading}
                  >
                    {auditLogLoading ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Load audit log
                  </Button>
                )}
              </div>
            </CardHeader>
            {auditLogVisible && (
              <CardContent>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No role changes recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left font-semibold">Member</th>
                          <th className="px-3 py-2 text-left font-semibold">From</th>
                          <th className="px-3 py-2 text-left font-semibold">To</th>
                          <th className="px-3 py-2 text-left font-semibold">Changed by</th>
                          <th className="px-3 py-2 text-left font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map((entry) => (
                          <tr key={entry.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 font-medium">
                              {entry.user.full_name || entry.user.id}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge[entry.old_role]?.className ?? ""}`}>
                                {roleBadge[entry.old_role]?.label ?? entry.old_role}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge[entry.new_role]?.className ?? ""}`}>
                                {roleBadge[entry.new_role]?.label ?? entry.new_role}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {entry.changed_by.full_name || entry.changed_by.id}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {isOwner && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/circles/${id}/edit`}>Edit circle (Settings)</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/circles/${id}/analytics`}>Analytics</Link>
              </Button>
            </>
          )}
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
