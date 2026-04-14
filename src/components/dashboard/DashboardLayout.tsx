"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { TopAppBar } from "./TopAppBar";
import { BottomTabBar } from "./BottomTabBar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          router.push("/login?redirect=" + encodeURIComponent(pathname));
          return;
        }

        setUserId(user.id);
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/login?redirect=" + encodeURIComponent(pathname));
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname, supabase]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopAppBar userId={userId} />
      <main className="flex-1 pb-20 pt-0">{children}</main>
      <BottomTabBar />
    </div>
  );
}

