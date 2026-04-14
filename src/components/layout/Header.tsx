"use client";

import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { ArchesLogo } from "@/components/icons/ArchesLogo";
import { usePathname } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-22 justify-between">
          <div className="flex">
            <div className="flex shrink-0 items-center">
              <Link href="/" aria-label="Arches Network Home">
                <ArchesLogo format="emblem" width={50} />
              </Link>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/circles"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === "/circles"
                    ? "border-orange-500 text-gray-900 hover:border-orange-300 hover:text-gray-900"
                    : "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900"
                }`}
              >
                Circles
              </Link>
              <Link
                href="/pricing"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === "/pricing"
                    ? "border-orange-500 text-gray-900 hover:border-orange-300 hover:text-gray-900"
                    : "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900"
                }`}
              >
                Pricing
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {user ? (
              <Link
                href="/dashboard"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === "/dashboard"
                    ? "border-orange-500 text-gray-900 hover:border-orange-300 hover:text-gray-900"
                    : "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900"
                }`}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-2xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium"
                >
                  Get Started
                </Link>
                <Link
                  href="/login"
                  className={`ml-4 inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                    pathname === "/login"
                      ? "border-orange-500 text-gray-900 hover:border-orange-300 hover:text-gray-900"
                      : "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900"
                  }`}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

