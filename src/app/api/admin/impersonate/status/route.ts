import { NextResponse } from "next/server";
import { getImpersonationState } from "@/utils/auth/impersonation";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const impersonationState = await getImpersonationState();

    if (impersonationState.isImpersonating && impersonationState.impersonatedUserId) {
      const supabase = await createClient();
      const { data: impersonatedProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", impersonationState.impersonatedUserId)
        .single();

      if (profileError || !impersonatedProfile) {
        console.warn("Impersonation active but impersonated user profile not found:", profileError?.message);
        return NextResponse.json({ isImpersonating: false });
      }

      return NextResponse.json({
        isImpersonating: true,
        impersonatedUser: impersonatedProfile,
        originalAdminId: impersonationState.originalAdminId,
      });
    }

    return NextResponse.json({ isImpersonating: false });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/impersonate/status:", error);
    return NextResponse.json(
      { error: "Failed to get impersonation status", details: (error as Error).message },
      { status: 500 }
    );
  }
}



