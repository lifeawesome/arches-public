import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canManageMembers } from "@/lib/utils/circles/access-control";
import type { CircleMemberWithProfile, CircleMemberRole } from "@/types/circles";

type MemberWithRole = Omit<CircleMemberWithProfile, "role"> & { role: CircleMemberRole | "owner" };

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/members
 * List circle members with profile and role. Owner included as first row with role 'owner'.
 * Allowed if user can manage members (owner/moderator) or is active member and circle has show_member_list.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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
      .select("id, expert_id, settings, created_at")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const canManage = await canManageMembers(circleId, user.id);
    const showMemberList = (circle.settings as { show_member_list?: boolean } | null)?.show_member_list ?? false;

    if (!canManage) {
      if (!showMemberList) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: myMembership } = await supabase
        .from("circle_memberships")
        .select("id")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();
      if (!myMembership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const expertId = (circle as { expert_id: string }).expert_id;

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, expertise")
      .eq("id", expertId)
      .single();

    const ownerRow: MemberWithRole = {
      id: `owner-${expertId}`,
      circle_id: circleId,
      user_id: expertId,
      role: "owner",
      membership_type: "free",
      status: "active",
      joined_at: (circle as { created_at?: string }).created_at ?? new Date().toISOString(),
      profile: {
        id: expertId,
        full_name: ownerProfile?.full_name ?? "",
        avatar_url: ownerProfile?.avatar_url ?? undefined,
        expertise: ownerProfile?.expertise ?? undefined,
      },
    };

    const { data: memberships, error: membersError } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, user_id, role, membership_type, status, joined_at, invited_by, invitation_token, invitation_sent_at, invitation_accepted_at, invitation_expires_at, invited_email, notes")
      .eq("circle_id", circleId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });

    if (membersError) {
      console.error("Error fetching members:", membersError);
      return NextResponse.json(
        { error: "Failed to fetch members", details: membersError.message },
        { status: 500 }
      );
    }

    const userIds = [...new Set([expertId, ...(memberships ?? []).map((m: { user_id: string | null }) => m.user_id).filter(Boolean)])] as string[];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, expertise")
      .in("id", userIds);

    const profileMap = new Map(
      (profilesData ?? []).map((p: { id: string; full_name: string; avatar_url?: string; expertise?: string }) => [p.id, p])
    );

    const memberRows: CircleMemberWithProfile[] = (memberships ?? []).map((m: Record<string, unknown>) => {
      const uid = m.user_id as string | null;
      const profile = uid ? profileMap.get(uid) : undefined;
      return {
        id: m.id as string,
        circle_id: m.circle_id as string,
        user_id: uid,
        role: m.role as CircleMemberWithProfile["role"],
        membership_type: (m.membership_type as string) === "paid" ? "paid" : "free",
        status: m.status as CircleMemberWithProfile["status"],
        joined_at: m.joined_at as string,
        invited_by: m.invited_by as string | undefined,
        invitation_token: m.invitation_token as string | undefined,
        invitation_sent_at: m.invitation_sent_at as string | undefined,
        invitation_accepted_at: m.invitation_accepted_at as string | null | undefined,
        invitation_expires_at: m.invitation_expires_at as string | null | undefined,
        invited_email: m.invited_email as string | null | undefined,
        notes: m.notes as string | undefined,
        profile: {
          id: profile?.id ?? uid ?? "",
          full_name: profile?.full_name ?? "",
          avatar_url: profile?.avatar_url,
          expertise: profile?.expertise,
        },
      };
    });

    const allMembers: MemberWithRole[] = [ownerRow, ...memberRows];
    const total = allMembers.length;

    const response: { members: MemberWithRole[]; total: number; page: number; per_page: number } = {
      members: allMembers,
      total,
      page: 1,
      per_page: Math.max(total, 1),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/circles/[id]/members:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
