"use client";

import { useEffect, useState } from "react";
import { getCurrentUserWithRoleClient, UserRole } from "@/utils/auth/roles.client";

interface AccountLinkProps {
  children: (props: { href: string; label: string }) => React.ReactNode;
}

export function AccountLink({ children }: AccountLinkProps) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRole() {
      const user = await getCurrentUserWithRoleClient();
      setRole(user?.role || null);
      setLoading(false);
    }
    loadRole();
  }, []);

  if (loading) {
    // Show default while loading
    return children({ href: "/account", label: "Account" });
  }

  // Admins go to admin portal, everyone else to account
  const href = role === "admin" ? "/admin" : "/account";
  const label = role === "admin" ? "Admin Portal" : "My Account";

  return children({ href, label });
}
