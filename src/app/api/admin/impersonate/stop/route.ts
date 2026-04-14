import { NextRequest, NextResponse } from "next/server";
import { IMPERSONATION_COOKIES } from "@/utils/auth/impersonation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const body = await request.json().catch(() => ({})); // Try to get body, fallback to empty object
    
    // Only allow stopping if impersonation cookies exist
    const impersonatedUserId = cookieStore.get(
      IMPERSONATION_COOKIES.IMPERSONATED_USER_ID
    )?.value;
    const originalAdminId = cookieStore.get(
      IMPERSONATION_COOKIES.ORIGINAL_ADMIN_ID
    )?.value;
    
    // Try to get session backup from cookie first, then from request body (client-side fallback)
    let adminSessionBackup = cookieStore.get(
      IMPERSONATION_COOKIES.ADMIN_SESSION_BACKUP
    )?.value;
    
    // If not found in cookies, try from request body (client-side cookie access)
    if (!adminSessionBackup && body.sessionBackupCookie) {
      adminSessionBackup = body.sessionBackupCookie;
      console.log("📦 Using session backup from request body (client-side cookie)");
    }

    console.log("🔍 Stop impersonation - Cookies found:");
    console.log("  - Impersonated User ID:", impersonatedUserId ? "present" : "missing");
    console.log("  - Original Admin ID:", originalAdminId ? "present" : "missing");
    console.log("  - Admin Session Backup:", adminSessionBackup ? "present" : "missing");
    
    if (adminSessionBackup) {
      console.log("  - Backup length:", adminSessionBackup.length);
      console.log("  - Backup preview:", adminSessionBackup.substring(0, 50) + "...");
    }

    if (!impersonatedUserId || !originalAdminId) {
      return NextResponse.json(
        { error: "Not currently impersonating" },
        { status: 400 }
      );
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Impersonation stopped",
    });

    // Return the admin session backup to the client so it can restore it client-side
    // This is necessary because hash-based sessions need to be restored on the client
    // The backup is stored as base64url encoded JSON, so we need to decode it first
    let sessionBackup = null;
    if (adminSessionBackup) {
      try {
        // Decode from base64url to get the JSON string
        const decodedBackup = Buffer.from(adminSessionBackup, "base64url").toString("utf-8");
        sessionBackup = JSON.parse(decodedBackup);
      } catch (parseError) {
        console.error("Error parsing admin session backup:", parseError);
        // Try parsing directly in case it's already JSON (for backwards compatibility)
        try {
          sessionBackup = JSON.parse(adminSessionBackup);
        } catch (directParseError) {
          console.error("Error parsing admin session backup directly:", directParseError);
        }
      }
    }

    // Clear impersonation cookies
    response.cookies.delete(IMPERSONATION_COOKIES.IMPERSONATED_USER_ID);
    response.cookies.delete(IMPERSONATION_COOKIES.ORIGINAL_ADMIN_ID);
    response.cookies.delete(IMPERSONATION_COOKIES.ADMIN_SESSION_BACKUP);

    return NextResponse.json({
      success: true,
      message: "Impersonation stopped",
      sessionBackup: sessionBackup ? {
        access_token: sessionBackup.access_token,
        refresh_token: sessionBackup.refresh_token,
      } : null,
    });
  } catch (error: any) {
    console.error("Error in POST /api/admin/impersonate/stop:", error);
    return NextResponse.json(
      { error: "Failed to stop impersonation", details: error.message },
      { status: 500 }
    );
  }
}

