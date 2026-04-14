"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Zap, Award, Users } from "lucide-react";

export function BottomTabBar() {
  const pathname = usePathname();

  const tabs = [
    {
      href: "/dashboard",
      label: "Home",
      icon: Home,
    },
    {
      href: "/dashboard/paths",
      label: "Paths",
      icon: Map,
    },
    {
      href: "/dashboard/action",
      label: "Action",
      icon: Zap,
      emphasized: true,
    },
    {
      href: "/dashboard/progress",
      label: "Progress",
      icon: Award,
    },
    {
      href: "/dashboard/circles",
      label: "Circles",
      icon: Users,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          const isEmphasized = tab.emphasized;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-tour={tab.href === "/dashboard/paths" ? "bottom-nav-paths" : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              } ${isEmphasized ? "flex-1" : ""}`}
            >
              <Icon
                className={`${
                  isEmphasized ? "h-6 w-6" : "h-5 w-5"
                } ${active ? "text-primary" : ""} ${
                  isEmphasized && active
                    ? "drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                    : ""
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

