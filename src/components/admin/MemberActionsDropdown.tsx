"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, User, Copy, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Member } from "@/lib/admin/member-queries";

interface MemberActionsDropdownProps {
  member: Member;
  currentUserId?: string | null;
}

export default function MemberActionsDropdown({
  member,
  currentUserId,
}: MemberActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Check if impersonation is disabled for this member (current user)
  const canImpersonate = currentUserId && member.id !== currentUserId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleImpersonate = async () => {
    if (!canImpersonate) {
      alert("Cannot impersonate yourself");
      setIsOpen(false);
      return;
    }

    if (!confirm(`Are you sure you want to impersonate ${member.full_name || member.email}?`)) {
      setIsOpen(false);
      return;
    }

    setIsImpersonating(true);
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetUserId: member.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to impersonate user");
      }

      // The API has set impersonation cookies in the response
      // Now navigate to the magic link which will:
      // 1. Create a session for the target user (replacing admin session)
      // 2. Redirect to /auth/callback?next=/dashboard
      // 3. Which redirects to /dashboard
      // 4. At that point, impersonation cookies will be in place and banner will show
      if (data.magicLink) {
        // Navigate to magic link - it will handle session creation and redirect
        window.location.href = data.magicLink;
      } else {
        // Fallback: reload dashboard (shouldn't happen but just in case)
        window.location.href = "/dashboard";
      }
    } catch (error: any) {
      console.error("Impersonation error:", error);
      alert(`Failed to impersonate user: ${error.message}`);
    } finally {
      setIsImpersonating(false);
      setIsOpen(false);
    }
  };

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard.writeText(member.id);
      // TODO: Show toast notification
      alert("User ID copied to clipboard");
    } catch (error) {
      console.error("Failed to copy user ID:", error);
    }
    setIsOpen(false);
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(member.email);
      // TODO: Show toast notification
      alert("Email copied to clipboard");
    } catch (error) {
      console.error("Failed to copy email:", error);
    }
    setIsOpen(false);
  };

  const handleViewProfile = () => {
    router.push(`/admin/members/${member.id}`);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg p-1.5 hover:bg-muted transition-colors"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border-2 border-border bg-background shadow-lg">
          {canImpersonate && (
            <button
              onClick={handleImpersonate}
              disabled={isImpersonating}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              <User className="h-4 w-4" />
              {isImpersonating ? "Impersonating..." : "Impersonate"}
            </button>
          )}
          <button
            onClick={handleCopyUserId}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
          >
            <Copy className="h-4 w-4" />
            Copy user ID
          </button>
          <button
            onClick={handleCopyEmail}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
          >
            <Mail className="h-4 w-4" />
            Copy email
          </button>
          <button
            onClick={handleViewProfile}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
          >
            <User className="h-4 w-4" />
            View profile
          </button>
        </div>
      )}
    </div>
  );
}

