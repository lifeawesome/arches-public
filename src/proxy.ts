import { type NextRequest, NextResponse } from "next/server";
import { updateSession, createClient } from "@/utils/supabase/middleware";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";

// Next.js 16: Use proxy.ts instead of middleware.ts
// This runs on the Node.js runtime and handles auth token refresh
export async function proxy(request: NextRequest) {
  // ONLY log in development to reduce overhead
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    console.log("🔍 Proxy:", request.nextUrl.pathname);
  }

  // Update Supabase session (handles refresh tokens)
  const response = await updateSession(request);

  // If updateSession returned a redirect, return it
  if (response.status === 307 || response.status === 308) {
    return response;
  }

  // Check for Supabase auth cookies
  const authCookies = request.cookies
    .getAll()
    .filter(
      (cookie) =>
        cookie.name.startsWith("sb-") &&
        (cookie.name.includes("auth-token") ||
          cookie.name.includes("access-token")) &&
        cookie.value &&
        cookie.value.length > 10
    );

  // Additional validation: check if cookie value looks like a valid token
  const hasValidAuthCookies = authCookies.some(
    (cookie) =>
      cookie.value.startsWith("base64-") ||
      cookie.value.startsWith("eyJ") ||
      cookie.value.length > 50
  );

  // Define protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/onboarding", "/admin"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Check if user is authenticated for protected routes
  if (isProtectedRoute && !hasValidAuthCookies) {
    if (isDev) {
      console.log("🔒 Redirecting unauthenticated user to /login");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Special check for /admin routes: require administrator access level
  if (request.nextUrl.pathname.startsWith("/admin")) {
    try {
      const { supabase } = createClient(request);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isDev) {
          console.log("🔒 No user found, redirecting to /login");
        }
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirect", request.nextUrl.pathname);
        return NextResponse.redirect(url);
      }

      // Check if user has administrator access level
      const profile = await getAppRBACProfile(supabase, user.id);
      if (
        !profile ||
        !hasAppAccessLevel(profile.app_access_level, "administrator")
      ) {
        if (isDev) {
          console.log(
            "🚫 User does not have administrator access, redirecting to /dashboard"
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error("Error checking admin access:", error);
      // On error, redirect to dashboard for safety
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Define auth pages (login, signup, etc.)
  const authPages = ["/login", "/signup"];
  const isAuthPage = authPages.some((page) =>
    request.nextUrl.pathname.startsWith(page)
  );

  // Auth pages: redirect authenticated users to dashboard
  if (isAuthPage && hasValidAuthCookies) {
    if (isDev) {
      console.log("🔄 Redirecting authenticated user to /dashboard");
    }
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match routes that need auth checks or token refresh
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/auth/:path*",
  ],
};

