"use client";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BarChart3, Briefcase } from "lucide-react";

const tabs = [
  {
    name: "Overview",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    name: "Experts",
    href: "/admin/analytics/experts",
    icon: Briefcase,
  },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="space-y-6">
          {/* Tabs Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.icon;

                return (
                  <Link
                    key={tab.name}
                    href={tab.href}
                    className={cn(
                      "group inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors",
                      isActive
                        ? "border-purple-500 text-purple-600"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isActive
                          ? "text-purple-600"
                          : "text-gray-400 group-hover:text-gray-500"
                      )}
                    />
                    {tab.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          {children}
        </div>
      </div>
    </AdminLayout>
  );
}
