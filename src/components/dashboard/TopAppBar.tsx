"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, Flame, Settings, Shield, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getUserXP, getUserStreak } from "@/lib/dashboard/queries";
import type { UserStreak } from "@/lib/dashboard/queries";
import type { NotificationEvent } from "@/types/notifications";
import { getAvatarUrl } from "@/lib/utils/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { NotificationPanel } from "@/components/dashboard/NotificationPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopAppBarProps {
  userId: string;
}

export function TopAppBar({ userId }: TopAppBarProps) {
  const [xp, setXp] = useState<number>(0);
  const [streak, setStreak] = useState<UserStreak>({
    currentStreak: 0,
    bestStreak: 0,
    lastActivityDate: null,
  });
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [effectiveUserId, setEffectiveUserId] = useState<string>(userId);
  const [circleNameById, setCircleNameById] = useState<Record<string, string>>({});
  const supabase = createClient();

  // Ensure we always use the active session user id (impersonation can change it)
  useEffect(() => {
    let mounted = true;
    const syncUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (data.user?.id) setEffectiveUserId(data.user.id);
      else setEffectiveUserId(userId);
    };

    syncUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, userId]);

  const hydrateCircleNames = async (events: NotificationEvent[]) => {
    const circleIds = Array.from(
      new Set(
        events
          .map((e) => ((e.metadata as any)?.circle_id as string | undefined) ?? null)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      )
    );
    if (circleIds.length === 0) return;

    const missing = circleIds.filter((id) => !circleNameById[id]);
    if (missing.length === 0) return;

    const { data, error } = await supabase
      .from("circles")
      .select("id, name")
      .in("id", missing);
    if (error) {
      console.error("Error fetching circle names:", error);
      return;
    }

    setCircleNameById((prev) => {
      const next = { ...prev };
      for (const row of data ?? []) {
        next[(row as any).id] = (row as any).name;
      }
      return next;
    });
  };

  const markAllNotificationsRead = async () => {
    if (!effectiveUserId) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notification_events")
      .update({ read_at: now })
      .eq("user_id", effectiveUserId)
      .is("read_at", null);

    if (error) {
      console.error("Error marking notifications read:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))
    );
  };

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const { data, error } = await supabase
        .from("notification_events")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      const events = (data ?? []) as NotificationEvent[];
      setNotifications(events);
      await hydrateCircleNames(events);
    } catch (e) {
      console.error("Error fetching notifications:", e);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [xpData, streakData, notificationsRes, profileData, authData] = await Promise.all([
          getUserXP(supabase, userId),
          getUserStreak(supabase, userId),
          supabase
            .from("notification_events")
            .select("*")
            .eq("user_id", effectiveUserId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("profiles")
            .select("avatar_url, full_name, app_access_level")
            .eq("id", userId)
            .single(),
          supabase.auth.getUser(),
        ]);

        setXp(xpData);
        setStreak(streakData);
        if (notificationsRes.error) {
          console.error("Error fetching notifications:", notificationsRes.error);
          setNotifications([]);
        } else {
          const events = ((notificationsRes.data ?? []) as unknown) as NotificationEvent[];
          setNotifications(events);
          await hydrateCircleNames(events);
        }
        if (profileData.data) {
          setAvatarUrl(getAvatarUrl(profileData.data.avatar_url));
          setUserName(profileData.data.full_name || "");

          // Check if user is an administrator using the new app_access_level system
          if (profileData.data.app_access_level === "administrator") {
            setIsAdmin(true);
          }
        }
        if (authData.data.user) {
          setUserEmail(authData.data.user.email || "");
        }
      } catch (error) {
        console.error("Error fetching top bar data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId, effectiveUserId, supabase]);

  // Realtime: update notifications instantly
  useEffect(() => {
    if (!effectiveUserId) return;

    const channel = supabase
      .channel(`notification-events:${effectiveUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_events",
          filter: `user_id=eq.${effectiveUserId}`,
        },
        (payload: { new: NotificationEvent }) => {
          const next = payload.new;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === next.id)) return prev;
            return [next, ...prev].slice(0, 50);
          });
          hydrateCircleNames([next]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notification_events",
          filter: `user_id=eq.${effectiveUserId}`,
        },
        (payload: { new: NotificationEvent }) => {
          const next = payload.new;
          setNotifications((prev) =>
            prev.map((n) => (n.id === next.id ? next : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, effectiveUserId]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80 focus:outline-none"
            >
              {avatarUrl ? (
                <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-border">
                  <Image
                    src={avatarUrl}
                    alt={userName || "Profile"}
                    fill
                    className="object-cover"
                    unoptimized={avatarUrl.includes("127.0.0.1") || avatarUrl.includes("localhost") || avatarUrl.includes("supabase")}
                  />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground">
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {userName || "User"}
                </p>
                {userEmail && (
                  <p className="text-xs leading-none text-muted-foreground">
                    {userEmail}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin Dashboard</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/dashboard/circles" className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                <span>My Circles</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings & Preferences</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Center: XP and Streak */}
        <div className="flex flex-1 items-center justify-center gap-4">
          {/* XP Display */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">XP</span>
            <span className="text-lg font-bold text-primary">
              {isLoading ? "..." : xp.toLocaleString()}
            </span>
          </div>

          {/* Streak Display */}
          {streak.currentStreak > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
              <Flame className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                {streak.currentStreak}
              </span>
            </div>
          )}
        </div>

        {/* Right: Notifications */}
        <Popover
          open={notificationOpen}
          onOpenChange={async (open) => {
            setNotificationOpen(open);
            if (open) {
              await fetchNotifications();
              await markAllNotificationsRead();
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative flex shrink-0 items-center justify-center transition-opacity hover:opacity-80"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-80 p-0">
            <NotificationPanel
              notifications={notifications}
              unreadCount={unreadCount}
              isLoading={notificationsLoading}
              circleNameById={circleNameById}
            />
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}



