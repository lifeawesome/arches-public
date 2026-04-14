"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface ImpersonationStatus {
  isImpersonating: boolean;
  impersonatedUserId?: string;
  originalAdminId?: string;
  impersonatedUser?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export function ImpersonationBanner() {
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/admin/impersonate/status");
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
          return data.isImpersonating;
        }
      } catch (error) {
        console.error("Error fetching impersonation status:", error);
      } finally {
        setLoading(false);
      }
      return false;
    }

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = async () => {
      const isActive = await fetchStatus();
      
      // Only poll if impersonation is active
      if (isActive) {
        intervalId = setInterval(async () => {
          const stillActive = await fetchStatus();
          if (!stillActive && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }, 5000);
      }
    };

    startPolling();
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const handleStopImpersonation = async () => {
    setIsStopping(true);
    try {
      // Read the session backup cookie client-side and send it in the request
      // This ensures we can access it even if server-side reading fails
      const getCookie = (name: string): string | null => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          return parts.pop()?.split(';').shift() || null;
        }
        return null;
      };

      // Debug: List all cookies
      console.log("🔍 All cookies:", document.cookie);
      
      let adminSessionBackup = getCookie("admin_session_backup");
      console.log("🔍 Client-side cookie check - admin_session_backup:", adminSessionBackup ? `found (length: ${adminSessionBackup.length})` : "not found");
      
      // Fallback: check localStorage if cookie wasn't found (might be too large)
      if (!adminSessionBackup) {
        try {
          const stored = localStorage.getItem("admin_session_backup");
          if (stored) {
            adminSessionBackup = stored;
            console.log("✅ Found session backup in localStorage (fallback)");
            // Clean up localStorage after retrieving
            localStorage.removeItem("admin_session_backup");
          }
        } catch (e) {
          console.warn("⚠️ Could not read localStorage:", e);
        }
      }
      
      // Also check the other impersonation cookies
      const impersonatedUserId = getCookie("impersonated_user_id");
      const originalAdminId = getCookie("original_admin_id");
      console.log("🔍 Other cookies - impersonated_user_id:", impersonatedUserId ? "found" : "not found");
      console.log("🔍 Other cookies - original_admin_id:", originalAdminId ? "found" : "not found");

      const response = await fetch("/api/admin/impersonate/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionBackupCookie: adminSessionBackup, // Send cookie value in request body
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Restore admin session client-side if we have a backup
        if (data.sessionBackup?.access_token && data.sessionBackup?.refresh_token) {
          try {
            const supabase = createClient();
            console.log("🔄 Restoring admin session...");
            
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: data.sessionBackup.access_token,
              refresh_token: data.sessionBackup.refresh_token,
            });

            if (sessionError) {
              console.error("❌ Error restoring admin session:", sessionError);
              // If token is expired, try refreshing
              if (sessionError.message.includes("expired") || sessionError.message.includes("invalid")) {
                console.log("🔄 Token expired, attempting refresh...");
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) {
                  console.error("❌ Failed to refresh session:", refreshError);
                  alert("Your session has expired. Please log in again.");
                  window.location.href = "/login";
                  return;
                }
              } else {
                alert(`Failed to restore admin session: ${sessionError.message}`);
                setIsStopping(false);
                return;
              }
            }

            // Verify the session was restored by getting the user
            console.log("🔍 Verifying restored session...");
            const { data: { user }, error: getUserError } = await supabase.auth.getUser();
            
            if (getUserError || !user) {
              console.error("❌ Failed to verify restored session:", getUserError);
              alert("Session restored but couldn't verify user. Please log in again.");
              window.location.href = "/login";
              return;
            }

            console.log("✅ Admin session restored for user:", user.id);
            console.log("✅ Session expires at:", sessionData?.session?.expires_at);
            
            // Wait a moment for cookies to be set and session to stabilize
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.error("❌ Error restoring session:", error);
            alert(`Failed to restore session: ${error instanceof Error ? error.message : "Unknown error"}`);
            setIsStopping(false);
            return;
          }
        } else {
          console.warn("⚠️ No session backup provided");
          alert("No session backup found. You may need to log in again.");
        }

        // Clear impersonation cookies client-side immediately
        // The server clears them too, but this ensures they're gone right away
        const clearCookie = (name: string) => {
          document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
        };
        clearCookie("impersonated_user_id");
        clearCookie("original_admin_id");
        clearCookie("admin_session_backup");
        
        // Clear localStorage too if used
        try {
          localStorage.removeItem("admin_session_backup");
        } catch (e) {
          // Ignore errors
        }
        
        // Force status check immediately to hide banner
        setStatus({ isImpersonating: false });

        // Redirect to admin members page
        console.log("🔄 Redirecting to /admin/members...");
        window.location.href = "/admin/members";
      } else {
        console.error("Failed to stop impersonation:", data.error);
        alert(`Failed to stop impersonation: ${data.error}`);
        setIsStopping(false);
      }
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      alert("Failed to stop impersonation. Please try again.");
      setIsStopping(false);
    }
  };

  if (loading || !status?.isImpersonating) {
    return null;
  }

  const userName =
    status.impersonatedUser?.full_name ||
    status.impersonatedUser?.email ||
    "User";

  return (
    <div className="sticky top-0 left-0 right-0 z-50 w-full">
      <div className="border-b-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-yellow-700 dark:text-yellow-400" />
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              You are viewing as <strong>{userName}</strong>
            </p>
          </div>
          <button
            onClick={handleStopImpersonation}
            disabled={isStopping}
            className="flex items-center gap-2 rounded-lg border-2 border-yellow-300 bg-white px-4 py-2 text-sm font-medium text-yellow-900 transition-colors hover:bg-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-yellow-900 dark:hover:bg-yellow-800 dark:border-yellow-700 dark:text-yellow-100"
          >
            <X className="h-4 w-4" />
            {isStopping ? "Stopping..." : "Exit Impersonation"}
          </button>
        </div>
      </div>
    </div>
  );
}

