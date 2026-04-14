"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ArrowLeft, Mail, Calendar, User, Shield } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getMemberById, type Member } from "@/lib/admin/member-queries";
import Image from "next/image";
import Link from "next/link";

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const memberData = await getMemberById(supabase, memberId);
        setMember(memberData);
      } catch (error) {
        console.error("Error fetching member:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (memberId) {
      fetchMember();
    }
  }, [memberId, supabase]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </AdminLayout>
    );
  }

  if (!member) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="rounded-lg border-2 border-border bg-background p-8 text-center">
            <p className="text-muted-foreground">Member not found</p>
            <Link
              href="/admin/members"
              className="mt-4 inline-block text-primary hover:underline"
            >
              ← Back to Members
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const displayName = member.full_name || member.email.split("@")[0] || "User";
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

  const getRoleDisplay = (member: Member) => {
    const role = member.app_access_level || member.role;
    if (!role) return { label: "User", color: "bg-muted text-muted-foreground" };

    const roleMap: Record<string, { label: string; color: string }> = {
      administrator: { label: "Administrator", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const roleDisplay = getRoleDisplay(member);
  const subscriptionDisplay = getSubscriptionDisplay(member);

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/members"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Link>
          <h1 className="text-4xl font-bold mb-2">Member Profile</h1>
          <p className="text-muted-foreground">
            View detailed information about this member
          </p>
        </div>

        {/* Profile Card */}
        <div className="rounded-lg border-2 border-border bg-background">
          <div className="p-8">
            {/* Avatar and Basic Info */}
            <div className="mb-8 flex items-start gap-6">
              {member.avatar_url ? (
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-border">
                  <Image
                    src={member.avatar_url}
                    alt={displayName}
                    fill
                    className="object-cover"
                    unoptimized={
                      member.avatar_url.includes("127.0.0.1") ||
                      member.avatar_url.includes("localhost") ||
                      member.avatar_url.includes("supabase")
                    }
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border bg-primary/10 text-2xl font-medium text-primary">
                  {getInitials(member.full_name, member.email)}
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">{displayName}</h2>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{member.email}</span>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${roleDisplay.color}`}>
                    {roleDisplay.label}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${subscriptionDisplay.color}`}>
                    {subscriptionDisplay.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Account Information */}
              <div className="rounded-lg border border-border bg-muted/30 p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <User className="h-5 w-5" />
                  Account Information
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">User ID</dt>
                    <dd className="mt-1 font-mono text-sm">{member.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                    <dd className="mt-1 text-sm">{member.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Full Name</dt>
                    <dd className="mt-1 text-sm">{member.full_name || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      {formatDate(member.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      {formatDate(member.updated_at)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Role & Subscription */}
              <div className="rounded-lg border border-border bg-muted/30 p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Shield className="h-5 w-5" />
                  Role & Subscription
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Access Level (New App)</dt>
                    <dd className="mt-1 text-sm">{member.app_access_level || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Role (Legacy)</dt>
                    <dd className="mt-1 text-sm">{member.role || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Subscription Tier (New App)</dt>
                    <dd className="mt-1 text-sm">{member.app_subscription_tier || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Subscription Tier (Legacy)</dt>
                    <dd className="mt-1 text-sm">{member.subscription_tier || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Subscription Status</dt>
                    <dd className="mt-1 text-sm">{member.subscription_status || "Inactive"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Next Billing Date</dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      {formatDate(member.next_billing_date)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}



