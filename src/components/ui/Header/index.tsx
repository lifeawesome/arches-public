"use client";
import { ArchesLogo } from "@/components/icons/ArchesLogo";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import {
  Bars3Icon,
  BellIcon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MenuItemData from "@/fixtures/menu-items.json";
import { MenuItemType } from "@/types/menu";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { Button } from "../button";
import { Badge } from "../badge";
import { useRouter } from "next/navigation";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { createClient } from "@/utils/supabase/client";
import { clearAllSessionData } from "@/utils/auth/clear-session";
import { useEffect, useState } from "react";

const menuItems: MenuItemType[] = MenuItemData;

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [avatar, setAvatar] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        
        if (authUser) {
          setUser(authUser);
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", authUser.id)
            .single();
          setAvatar(profile?.avatar_url || "");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [supabase]);

  // Get unread message count for authenticated users
  // Increased from 30s to 2min to reduce egress and improve performance
  const { unreadData } = useUnreadMessages(user ? 120000 : 0); // Poll every 2min if logged in

  const handleSignOut = async () => {
    try {
      const supabase = createClient();

      // Sign out from Supabase (clears server-side session)
      await supabase.auth.signOut();

      // Explicitly clear all client-side session data including cookies
      clearAllSessionData();

      // Force a hard redirect to ensure everything is cleared
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
      // Even if signOut fails, clear session data and redirect
      clearAllSessionData();
      window.location.href = "/";
    }
  };
  return (
    <Disclosure
      as="nav"
      className="bg-white shadow-sm sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-22 justify-between">
          <div className="flex">
            <div className="flex shrink-0 items-center">
              <Link href="/">
                <ArchesLogo format="emblem" width={50} />
              </Link>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {/* Current: "border-orange-500 text-gray-900", Default: "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900" */}
              {menuItems
                .filter((item) => !item.hidden)
                .map((item, key) => {
                  if (item.dropdown) {
                    // Check if any dropdown item is active
                    const isActive = item.dropdown.some(
                      (dropdownItem) => pathname === dropdownItem.path
                    );

                    return (
                      <div
                        key={key}
                        className="relative group h-full inline-flex items-center px-1 pt-1 text-sm font-medium"
                      >
                        <Link
                          href={item.path}
                          className={`inline-flex h-full items-center whitespace-nowrap  border-b-2 px-1 pt-1 text-sm font-medium  ${
                            isActive
                              ? "border-orange-500 text-gray-900 hover:border-orange-300 hover:text-gray-900"
                              : "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900"
                          }`}
                        >
                          {item.name}
                          <ChevronDownIcon
                            className="ml-1 h-4 w-4 "
                            aria-hidden="true"
                          />
                        </Link>
                        <div className="absolute left-1/2 z-10 mt-30 w-48 -translate-x-1/2 origin-top rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                          {item.dropdown.map((dropdownItem, dropdownKey) => (
                            <Link
                              key={dropdownKey}
                              href={dropdownItem.path}
                              className={`block px-4 py-2 text-sm ${
                                pathname === dropdownItem.path
                                  ? "bg-gray-100 text-gray-900"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {dropdownItem.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <Link
                        key={key}
                        href={item.path}
                        className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                          pathname === item.path
                            ? "border-orange-500 text-gray-900 hover:border-orange-300 hover:text-gray-900"
                            : "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900"
                        } `}
                      >
                        {item.name}
                      </Link>
                    );
                  }
                })}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {/* Show signup buttons when not authenticated - also during loading to prevent flicker */}
            {!user && (
              <div className="flex items-center gap-2">
                {/* Beta Launch: Expert-focused CTA as primary */}
                <Button
                  className="rounded-2xl bg-orange-500 hover:bg-orange-600"
                  onClick={() => router.push("/signup?type=expert")}
                >
                  Apply as an Expert
                </Button>
                {/* Hidden during beta expert acquisition phase
                <Button
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => router.push("/signup?type=member")}
                >
                  Join the Network
                </Button>
                */}
              </div>
            )}
            {/* User menu - only show when authenticated */}
            {user && (
              <>
                <Link href="/account/messages">
                  <button
                    type="button"
                    className="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-hidden"
                  >
                    <span className="absolute -inset-1.5" />
                    <span className="sr-only">View messages</span>
                    <BellIcon aria-hidden="true" className="size-6" />
                    {unreadData.count > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                      >
                        {unreadData.count > 99 ? "99+" : unreadData.count}
                      </Badge>
                    )}
                  </button>
                </Link>

                <Menu as="div" className="relative ml-3">
                  <div>
                    <MenuButton className="relative flex rounded-full bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-hidden">
                      <span className="absolute -inset-1.5" />
                      <span className="sr-only">Open user menu</span>
                      <SmartAvatar
                        src={avatar}
                        alt={
                          user?.user_metadata?.full_name ||
                          user?.email ||
                          "User"
                        }
                        size={50}
                      />
                    </MenuButton>
                  </div>
                  <MenuItems
                    transition
                    className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 ring-1 shadow-lg ring-black/5 transition focus:outline-hidden data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                  >
                    <MenuItem>
                      <Link
                        href="/account"
                        className="block px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden"
                      >
                        My Account
                      </Link>
                    </MenuItem>
                    <MenuItem>
                      <Link
                        href="/account/settings"
                        className="block px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden"
                      >
                        Settings
                      </Link>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden"
                      >
                        Sign out
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </>
            )}

            {/* Signin Link - shown when not authenticated or during loading to prevent flicker */}
            {!user && (
              <Link
                href={"/login"}
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                  pathname === "/signin"
                    ? "border-orange-500 text-gray-900 hover:border-orange-300 hover:text-gray-900"
                    : "border-transparent text-gray-500 hover:border-orange-300 hover:text-gray-900"
                } `}
              >
                Sign In
              </Link>
            )}
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            {/* Mobile menu button */}
            <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-hidden focus:ring-inset">
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              <Bars3Icon
                aria-hidden="true"
                className="block size-6 group-data-open:hidden"
              />
              <XMarkIcon
                aria-hidden="true"
                className="hidden size-6 group-data-open:block"
              />
            </DisclosureButton>
          </div>
        </div>
      </div>
      <DisclosurePanel className="sm:hidden">
        <div className="space-y-1 pt-2 pb-3">
          {menuItems
            .filter((item) => !item.hidden)
            .map((item, key) => {
              if (item.dropdown) {
                return (
                  <div key={key}>
                    <div className="block border-l-4 border-transparent py-2 pr-4 pl-3 text-base font-medium text-gray-500">
                      {item.name}
                    </div>
                    {item.dropdown.map((dropdownItem, dropdownKey) => (
                      <DisclosureButton
                        key={dropdownKey}
                        as="a"
                        href={dropdownItem.path}
                        className={`block border-l-4 py-2 pr-4 pl-8 text-base font-medium ${
                          pathname === dropdownItem.path
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-transparent text-gray-500 hover:border-orange-300 hover:bg-orange-50 hover:text-gray-900"
                        }`}
                      >
                        {dropdownItem.name}
                      </DisclosureButton>
                    ))}
                  </div>
                );
              } else {
                return (
                  <DisclosureButton
                    key={key}
                    as="a"
                    href={item.path}
                    className={`block border-l-4 py-2 pr-4 pl-3 text-base font-medium ${
                      pathname === item.path
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-transparent text-gray-500 hover:border-orange-300 hover:bg-orange-50 hover:text-gray-900"
                    }`}
                  >
                    {item.name}
                  </DisclosureButton>
                );
              }
            })}
        </div>

        {/* Mobile: Show expert CTA when not authenticated */}
        {!user && (
          <div className="border-t border-gray-200 pt-4 pb-3 px-4">
            <Button
              className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600"
              onClick={() => router.push("/signup?type=expert")}
            >
              Apply as an Expert
            </Button>
            <Link
              href="/login"
              className="block text-center mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Mobile: User menu when authenticated */}
        {user && (
          <div className="border-t border-gray-200 pt-4 pb-3">
            <div className="flex items-center px-4">
              <div className="shrink-0">
                <SmartAvatar
                  src={avatar}
                  alt={user?.user_metadata?.full_name || user?.email || "User"}
                  size={50}
                />
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">
                  {user?.user_metadata?.first_name}{" "}
                  {user?.user_metadata?.last_name}
                </div>
                <div className="text-sm font-medium text-gray-500">
                  {user?.email}
                </div>
              </div>
              <Link href="/account/messages">
                <button
                  type="button"
                  className="relative ml-auto shrink-0 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-hidden"
                >
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">View messages</span>
                  <BellIcon aria-hidden="true" className="size-6" />
                  {unreadData.count > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-xs font-semibold"
                    >
                      {unreadData.count > 99 ? "99+" : unreadData.count}
                    </Badge>
                  )}
                </button>
              </Link>
            </div>
            <div className="mt-3 space-y-1">
              <DisclosureButton
                as="a"
                href="/account"
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                My Account
              </DisclosureButton>
              <DisclosureButton
                as="a"
                href="/account/settings"
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                Settings
              </DisclosureButton>
              <DisclosureButton
                as="button"
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                Sign out
              </DisclosureButton>
            </div>
          </div>
        )}
      </DisclosurePanel>
    </Disclosure>
  );
}
