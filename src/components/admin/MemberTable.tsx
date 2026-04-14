"use client";

import Image from "next/image";
import { ArrowUpDown } from "lucide-react";
import type { Member, SortField, SortDirection } from "@/lib/admin/member-queries";
import MemberActionsDropdown from "./MemberActionsDropdown";
import { getAvatarUrl } from "@/lib/utils/avatar";

interface MemberTableProps {
  members: Member[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  currentUserId?: string | null;
}

export default function MemberTable({
  members,
  sortField,
  sortDirection,
  onSort,
  currentUserId,
}: MemberTableProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRoleDisplay = (member: Member) => {
    // Prefer new app access level, fall back to old role
    const role = member.app_access_level || member.role;
    if (!role) return { label: "User", color: "bg-muted text-muted-foreground" };

    const roleMap: Record<string, { label: string; color: string }> = {
      administrator: { label: "Admin", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
      manager: { label: "Manager", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
      user: { label: "User", color: "bg-muted text-muted-foreground" },
      admin: { label: "Admin", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
      moderator: { label: "Moderator", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
      member: { label: "Member", color: "bg-muted text-muted-foreground" },
    };

    return roleMap[role] || { label: role, color: "bg-muted text-muted-foreground" };
  };

  const getSubscriptionDisplay = (member: Member) => {
    const status = member.subscription_status;
    if (!status || status === "inactive") {
      return { label: "Free", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
    }

    const statusMap: Record<string, { label: string; color: string }> = {
      active: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
      trialing: { label: "Trialing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
      past_due: { label: "Past Due", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
      canceled: { label: "Canceled", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
    };

    return statusMap[status] || { label: status, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name[0].toUpperCase();
    }
    return email[0].toUpperCase();
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-primary"
    >
      {children}
      <ArrowUpDown className="h-4 w-4" />
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field="name">Name</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field="subscription">Subscription</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field="last_updated">Last Updated</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Next Billing</th>
            <th className="px-4 py-3 text-right text-sm font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                No members found
              </td>
            </tr>
          ) : (
            members.map((member) => {
              const roleDisplay = getRoleDisplay(member);
              const subscriptionDisplay = getSubscriptionDisplay(member);
              const displayName = member.full_name || member.email.split("@")[0] || "User";
              const resolvedAvatarUrl = getAvatarUrl(member.avatar_url);

              return (
                <tr
                  key={member.id}
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {resolvedAvatarUrl ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-border">
                          <Image
                            src={resolvedAvatarUrl}
                            alt={displayName}
                            fill
                            className="object-cover"
                            unoptimized={
                              resolvedAvatarUrl.includes("127.0.0.1") ||
                              resolvedAvatarUrl.includes("localhost") ||
                              resolvedAvatarUrl.includes("supabase")
                            }
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-primary/10 text-sm font-medium text-primary">
                          {getInitials(member.full_name, member.email)}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{displayName}</div>
                        {member.full_name && (
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleDisplay.color}`}
                    >
                      {roleDisplay.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${subscriptionDisplay.color}`}
                    >
                      {subscriptionDisplay.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(member.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(member.next_billing_date)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MemberActionsDropdown member={member} currentUserId={currentUserId} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

