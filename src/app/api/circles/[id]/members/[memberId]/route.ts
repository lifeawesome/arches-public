import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canManageRoles } from "@/lib/utils/circles/access-control";
import type { CircleMemberRole } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string; memberId: string }> };

/**
 * PATCH /api/circles/[id]/members/[memberId]
 * Update a member's role. Owner only. Writes to circle_role_audit_log.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, memberId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canChangeRoles = await canManageRoles(circleId, user.id);
    if (!canChangeRoles) {
      return NextResponse.json(
        { error: "Only the circle owner can change member roles" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { role?: CircleMemberRole };
    const { role } = body;
    if (role === undefined || !["member", "contributor", "moderator"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid or missing role; must be member, contributor, or moderator" },
        { status: 400 }
      );
    }

    const { data: membership, error: fetchError } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, user_id, role")
      .eq("id", memberId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const oldRole = membership.role as CircleMemberRole;
    if (oldRole === role) {
      return NextResponse.json({ membership: { ...membership, role } });
    }

    const { data: circle } = await supabase
      .from("circles")
      .select("expert_id")
      .eq("id", circleId)
      .single();

    if (circle && (circle as { expert_id: string }).expert_id === membership.user_id) {
      return NextResponse.json(
        { error: "Cannot change the circle owner's role" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("circle_memberships")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("circle_id", circleId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating membership role:", updateError);
      return NextResponse.json(
        { error: "Failed to update role", details: updateError.message },
        { status: 500 }
      );
    }

    const { error: auditError } = await supabase.from("circle_role_audit_log").insert({
      circle_id: circleId,
      membership_id: memberId,
      user_id: membership.user_id,
      changed_by: user.id,
      old_role: oldRole,
      new_role: role,
    });

    if (auditError) {
      console.error("Error writing audit log:", auditError);
    }

    return NextResponse.json({ membership: updated });
  } catch (err) {
    console.error("PATCH /api/circles/[id]/members/[memberId]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
