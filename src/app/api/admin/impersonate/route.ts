import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";
import { IMPERSONATION_COOKIES } from "@/utils/auth/impersonation";
import { cookies } from "next/headers";

// This requires the service role key for generating user tokens
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 }
      );
    }

    // Get the current admin user
    const supabase = await createServerClient();
    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser();

    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin is actually an administrator
    const adminProfile = await getAppRBACProfile(supabase, adminUser.id);
    if (
      !adminProfile ||
      !hasAppAccessLevel(adminProfile.app_access_level, "administrator")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prevent self-impersonation
    if (adminUser.id === targetUserId) {
      return NextResponse.json(
        { error: "Cannot impersonate yourself" },
        { status: 400 }
      );
    }

    // Get the target user's data
    const { data: targetUser, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(targetUserId);

    if (userError || !targetUser.user) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Get current admin session to backup
    const { data: adminSession } = await supabase.auth.getSession();
    
    if (!adminSession?.session) {
      return NextResponse.json(
        { error: "No active session found" },
        { status: 400 }
      );
    }

    // Get all current Supabase auth cookies to backup
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Extract project ref from Supabase URL for cookie naming
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const projectRef = supabaseUrl.hostname.split(".")[0];
    
    const authCookies: Array<{ name: string; value: string }> = [];
    
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith(`sb-${projectRef}-`)) {
        authCookies.push({ name: cookie.name, value: cookie.value });
      }
    });

    // Store admin session backup
    const adminSessionBackup = {
      access_token: adminSession.session.access_token,
      refresh_token: adminSession.session.refresh_token,
      expires_at: adminSession.session.expires_at,
      authCookies: authCookies,
    };

    // Create response
    const response = NextResponse.json({
      success: true,
      impersonatedUserId: targetUserId,
    });

    // Generate a session for the target user using admin API
    // Use admin API to create a magic link with redirect to our callback
    // Pass impersonation info via URL params so we can set cookies after session is created
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectUrl = new URL(`${siteUrl}/auth/callback`);
    redirectUrl.searchParams.set("next", "/dashboard");
    redirectUrl.searchParams.set("impersonate", "true");
    redirectUrl.searchParams.set("originalAdminId", adminUser.id);
    redirectUrl.searchParams.set("impersonatedUserId", targetUserId);
    
    // Encode the admin session backup as a base64 URL param (will be stored in cookie in callback)
    const sessionBackupBase64 = Buffer.from(JSON.stringify(adminSessionBackup)).toString("base64url");
    redirectUrl.searchParams.set("adminSessionBackup", sessionBackupBase64);

    const { data: tokenData, error: tokenError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.user.email!,
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });

    if (tokenError || !tokenData) {
      console.error("Error generating impersonation link:", tokenError);
      return NextResponse.json(
        { error: "Failed to generate impersonation session" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      impersonatedUserId: targetUserId,
      magicLink: tokenData.properties.action_link,
    });
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

