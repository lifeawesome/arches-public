"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Globe,
  FileText,
  BarChart3,
  BookOpen,
  FolderTree,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Flag,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getAvatarUrl } from "@/lib/utils/avatar";

interface AdminSidebarProps {
  userId: string;
}

export default function AdminSidebar({ userId }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url, full_name")
          .eq("id", user.id)
          .single();

        if (profile) {
          setAvatarUrl(getAvatarUrl(profile.avatar_url));
          setUserName(profile.full_name || "");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId, supabase]);

  const menuItems = [
    {
      href: "/admin",
      label: "Admin Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/admin/pathways",
      label: "Manage Pathways",
      icon: BookOpen,
    },
    {
      href: "/admin/members",
      label: "Member Manager",
      icon: Users,
    },
    {
      href: "/admin/surveys",
      label: "Surveys",
      icon: ClipboardList,
    },
    {
      href: "/admin/circle-categories",
      label: "Circle categories",
      icon: FolderTree,
    },
    {
      href: "/admin/platform-reports",
      label: "Platform reports",
      icon: Flag,
    },
    {
      href: "/admin/seo",
      label: "SEO Management",
      icon: Globe,
    },
    {
      href: "/admin/content",
      label: "Content",
      icon: FileText,
    },
    {
      href: "/admin/analytics",
      label: "Analytics",
      icon: BarChart3,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  const displayName = userName || userEmail.split("@")[0] || "User";
  const displayEmail = userEmail.length > 20 
    ? `${userEmail.substring(0, 17)}...` 
    : userEmail;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-background">
      {/* Administration Header */}
      <div className="border-b border-border p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between text-sm font-semibold text-primary"
        >
          <span>Administration</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Menu Items */}
      {isExpanded && (
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-primary"}`} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* User Profile Section */}
      <div className="border-t border-border p-4">
        {!isLoading && (
          <div className="mb-4 flex items-center gap-3">
            {avatarUrl ? (
              <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-border">
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized={
                    avatarUrl.includes("127.0.0.1") ||
                    avatarUrl.includes("localhost") ||
                    avatarUrl.includes("supabase")
                  }
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName.length > 14 
                    ? `${displayName.substring(0, 12)}...` 
                    : displayName}
                </p>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {displayEmail}
              </p>
            </div>
          </div>
        )}

        {/* Back to Site Button */}
        <Link
          href="/dashboard"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Site</span>
        </Link>
      </div>
    </aside>
  );
}

