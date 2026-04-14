import Link from "next/link";
import { ArchesLogo } from "@/components/icons/ArchesLogo";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mx-auto max-w-full px-6 bg-zinc-900">
      <div className="mx-auto max-w-[1280px] grid grid-cols-1 gap-8 py-12 text-white transition-colors duration-150 border-b lg:grid-cols-12 border-zinc-600 bg-zinc-900">
        {/* Logo */}
        <div className="col-span-2 lg:col-span-3">
          <Link
            href="/"
            className="flex items-center flex-initial font-bold md:mr-24"
          >
            <ArchesLogo format="wide" background="dark" width={140} />
          </Link>
        </div>

        {/* Main Navigation */}
        <div className="col-span-1 lg:col-span-2">
          <ul className="flex flex-col flex-initial md:flex-1">
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/"
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                Home
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/pricing"
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                Pricing
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div className="col-span-1 lg:col-span-2">
          <ul className="flex flex-col flex-initial md:flex-1">
            <li className="py-3 md:py-0 md:pb-4">
              <p className="font-bold text-white transition duration-150 ease-in-out hover:text-zinc-200">
                LEGAL
              </p>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/privacy"
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                Privacy Policy
              </Link>
            </li>
            <li className="py-3 md:py-0 md:pb-4">
              <Link
                href="/terms"
                className="text-white transition duration-150 ease-in-out hover:text-zinc-200"
              >
                Terms of Use
              </Link>
            </li>
          </ul>
        </div>

        {/* Spacer */}
        <div className="flex items-start col-span-1 text-white lg:col-span-5 lg:justify-end">
          <div className="flex items-center h-10 space-x-6"></div>
        </div>
      </div>

      {/* Copyright */}
      <div className="flex flex-col items-center justify-between py-12 space-y-4 md:flex-row bg-zinc-900 mx-auto max-w-[1280px]">
        <div>
          <span className="text-white transition duration-150 ease-in-out hover:text-zinc-200">
            &copy; {currentYear} Arches Network, LLC. All rights reserved.
          </span>
        </div>
        <div className="flex items-center"></div>
      </div>
    </footer>
  );
}

