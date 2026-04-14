"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// Cookie names for impersonation (client-safe)
const IMPERSONATION_COOKIES = {
  IMPERSONATED_USER_ID: "impersonated_user_id",
  ORIGINAL_ADMIN_ID: "original_admin_id",
  ADMIN_SESSION_BACKUP: "admin_session_backup",
} as const;

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleCallback() {
      const next = searchParams.get("next") || "/dashboard";
      const isImpersonating = searchParams.get("impersonate") === "true";
      const originalAdminId = searchParams.get("originalAdminId");
      const impersonatedUserId = searchParams.get("impersonatedUserId");
      let adminSessionBackup = searchParams.get("adminSessionBackup");
      
      console.log("🔍 Callback page - URL params:");
      console.log("  - isImpersonating:", isImpersonating);
      console.log("  - originalAdminId:", originalAdminId);
      console.log("  - impersonatedUserId:", impersonatedUserId);
      console.log("  - adminSessionBackup:", adminSessionBackup ? `present (length: ${adminSessionBackup.length})` : "missing");

      const supabase = createClient();

      // Check for tokens in hash (magic links often use hash fragments)
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = hashParams.get("code");

        if (accessToken && refreshToken) {
          // Set session directly from tokens
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("Error setting session:", sessionError);
            router.push("/login?error=session_error");
            return;
          }
        } else if (code) {
          // Exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("Error exchanging code:", exchangeError);
            router.push("/login?error=exchange_error");
            return;
          }
        }
      } else {
        // Check for code in query params
        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("Error exchanging code:", exchangeError);
            router.push("/login?error=exchange_error");
            return;
          }
        } else {
          // No code or tokens found
          console.error("No authentication code or tokens found in callback");
          router.push("/login?error=no_code");
          return;
        }
      }

      // Set impersonation cookies if applicable
      if (isImpersonating && originalAdminId && impersonatedUserId) {
        // Cookies will be set via document.cookie since we're client-side
        const cookieOptions = `path=/; max-age=${60 * 60 * 24}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
        
        console.log("🍪 Setting impersonation cookies...");
        console.log("  - originalAdminId:", originalAdminId);
        console.log("  - impersonatedUserId:", impersonatedUserId);
        console.log("  - adminSessionBackup:", adminSessionBackup ? `present (length: ${adminSessionBackup.length})` : "missing");
        
        document.cookie = `${IMPERSONATION_COOKIES.ORIGINAL_ADMIN_ID}=${originalAdminId}; ${cookieOptions}`;
        document.cookie = `${IMPERSONATION_COOKIES.IMPERSONATED_USER_ID}=${impersonatedUserId}; ${cookieOptions}`;
        
        if (adminSessionBackup) {
          // Cookie size limit is 4096 bytes - check if we're within limit
          const cookieString = `${IMPERSONATION_COOKIES.ADMIN_SESSION_BACKUP}=${adminSessionBackup}; ${cookieOptions}`;
          const cookieSize = cookieString.length;
          console.log("  - Cookie size:", cookieSize, "bytes (limit: 4096)");
          
          if (cookieSize > 4096) {
            console.error("⚠️ Cookie too large! Size:", cookieSize, "bytes - using localStorage fallback");
            // Store in localStorage as fallback for large backups
            try {
              localStorage.setItem("admin_session_backup", adminSessionBackup);
              console.log("✅ Stored session backup in localStorage");
            } catch (storageError) {
              console.error("❌ Failed to store in localStorage:", storageError);
            }
          } else {
            document.cookie = cookieString;
            console.log("✅ Session backup cookie set");
          }
        } else {
          console.warn("⚠️ No adminSessionBackup to set");
        }
        
        // Verify cookies were set
        const allCookies = document.cookie;
        console.log("🍪 Cookies after setting:", allCookies.substring(0, 300) + "...");
        const backupCookieFound = allCookies.includes(IMPERSONATION_COOKIES.ADMIN_SESSION_BACKUP);
        console.log("  - Backup cookie found in document.cookie:", backupCookieFound);
      }

      // Redirect to destination
      router.push(next);
    }

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

