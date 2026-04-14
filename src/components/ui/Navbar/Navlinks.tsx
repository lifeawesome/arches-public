"use client";

import Link from "next/link";
import { SignOut } from "@/lib/utils/auth-helpers/server";
import { handleRequest } from "@/lib/utils/auth-helpers/client";
import { ArchesLogo } from "@/components/icons/ArchesLogo";
import { usePathname, useRouter } from "next/navigation";
import s from "./Navbar.module.css";

interface NavlinksProps {
  user?: string;
}

export default function Navlinks({ user }: Readonly<NavlinksProps>) {
  const router = useRouter();
  const pathName = usePathname();

  return (
    <div className="relative flex flex-row justify-between py-4 align-center md:py-6">
      <div className="flex items-center flex-1">
        <Link href="/" className={s.logo} aria-label="Logo">
          <ArchesLogo />
        </Link>
        <nav className="ml-6 space-x-2 lg:block">
          <Link href="/circles" className={s.link}>
            Circles
          </Link>
          <Link href="/" className={s.link}>
            Pricing
          </Link>
          {user && (
            <Link href="/account" className={s.link}>
              Account
            </Link>
          )}
        </nav>
      </div>
      <div className="flex justify-end space-x-8">
        {user ? (
          <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
            <input type="hidden" name="pathName" value={pathName} />
            <button type="submit" className={s.link}>
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/signin" className={s.link}>
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
