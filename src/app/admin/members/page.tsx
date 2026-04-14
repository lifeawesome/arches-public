"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Users,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  getMembers,
  type Member,
  type MemberFilters,
  type SortField,
  type SortDirection,
} from "@/lib/admin/member-queries";
import MemberTable from "@/components/admin/MemberTable";
import MemberActionsDropdown from "@/components/admin/MemberActionsDropdown";

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<MemberFilters>({});
  const [sortField, setSortField] = useState<SortField>("last_updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtered, setFiltered] = useState(0);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);
  const [selectedSubscriptionFilter, setSelectedSubscriptionFilter] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, [supabase]);

  const pageSize = 50;

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentFilters: MemberFilters = {
        ...(searchQuery && { search: searchQuery }),
        ...(selectedRoleFilter && { role: selectedRoleFilter }),
        ...(selectedSubscriptionFilter && { subscription: selectedSubscriptionFilter }),
      };

      const result = await getMembers(supabase, {
        filters: currentFilters,
        sortField,
        sortDirection,
        page,
        pageSize,
      });

      setMembers(result.members);
      setTotal(result.total);
      setFiltered(result.filtered);
      setFilters(currentFilters);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, searchQuery, selectedRoleFilter, selectedSubscriptionFilter, sortField, sortDirection, page]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    alert("Export functionality coming soon");
  };

  const handleRoleFilter = (role: string | null) => {
    setSelectedRoleFilter(role);
    setPage(1);
  };

  const handleSubscriptionFilter = (subscription: string | null) => {
    setSelectedSubscriptionFilter(subscription);
    setPage(1);
  };

  const totalPages = Math.ceil(filtered / pageSize);

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Member Management</h1>
          <p className="text-muted-foreground">
            View and manage all platform members, subscriptions, and roles.
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-lg border-2 border-border bg-background">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Members Management</h2>
              <p className="text-sm text-muted-foreground">
                View and manage all platform members and their subscriptions.
              </p>
            </div>

            {/* Search and Filter Bar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-lg border-2 border-border bg-background pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <RoleFilterButton
                  selected={selectedRoleFilter}
                  onSelect={handleRoleFilter}
                />
                <SubscriptionFilterButton
                  selected={selectedSubscriptionFilter}
                  onSelect={handleSubscriptionFilter}
                />
                <button className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                  Columns
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  onClick={fetchMembers}
                  className="rounded-lg border-2 border-border bg-background p-2 hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Summary Counts */}
            <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span>Total: {total}</span>
              <span>Filtered: {filtered}</span>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading members...
              </div>
            ) : (
              <MemberTable
                members={members}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                currentUserId={currentUserId}
              />
            )}

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {members.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
                {Math.min(page * pageSize, filtered)} of {filtered} members
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-muted-foreground">
                  Page {page} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// Role Filter Button Component
function RoleFilterButton({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (role: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const roles = [
    { value: "administrator", label: "Administrator" },
    { value: "manager", label: "Manager" },
    { value: "user", label: "User" },
    { value: "admin", label: "Admin (Legacy)" },
    { value: "moderator", label: "Moderator (Legacy)" },
    { value: "member", label: "Member (Legacy)" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <Filter className="h-4 w-4" />
        Role
        {selected && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {roles.find((r) => r.value === selected)?.label || selected}
          </span>
        )}
        <ChevronDown className="h-4 w-4" />
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border-2 border-border bg-background shadow-lg">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${
                !selected ? "bg-primary/10 text-primary" : ""
              }`}
            >
              All Roles
            </button>
            {roles.map((role) => (
              <button
                key={role.value}
                onClick={() => {
                  onSelect(role.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${
                  selected === role.value ? "bg-primary/10 text-primary" : ""
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Subscription Filter Button Component
function SubscriptionFilterButton({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (subscription: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const subscriptions = [
    { value: "Free", label: "Free" },
    { value: "active", label: "Active" },
    { value: "trialing", label: "Trialing" },
    { value: "past_due", label: "Past Due" },
    { value: "canceled", label: "Canceled" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <Filter className="h-4 w-4" />
        Subscription
        {selected && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {subscriptions.find((s) => s.value === selected)?.label || selected}
          </span>
        )}
        <ChevronDown className="h-4 w-4" />
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border-2 border-border bg-background shadow-lg">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${
                !selected ? "bg-primary/10 text-primary" : ""
              }`}
            >
              All Subscriptions
            </button>
            {subscriptions.map((sub) => (
              <button
                key={sub.value}
                onClick={() => {
                  onSelect(sub.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-muted ${
                  selected === sub.value ? "bg-primary/10 text-primary" : ""
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
