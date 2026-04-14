"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";
import AdminSidebar from "./AdminSidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Check if user has administrator access level
        const profile = await getAppRBACProfile(supabase, user.id);

        if (
          !profile ||
          !hasAppAccessLevel(profile.app_access_level, "administrator")
        ) {
          router.push("/dashboard");
          return;
        }

        setUserId(user.id);
        setIsAuthorized(true);
      } catch (error) {
        console.error("Admin auth error:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [supabase, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized || !userId) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <AdminSidebar userId={userId} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}



