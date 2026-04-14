import { CookieOptions, createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const createClient = (request: NextRequest) => {
  // Create an unmodified response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, update the cookies for the request and response
          const cookieOptions = {
            ...options,
            ...(process.env.NODE_ENV === "production" && {
              domain: process.env.NEXT_PUBLIC_SITE_URL
                ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
                : undefined,
              secure: true,
            }),
            sameSite: "lax" as const,
          };

          request.cookies.set({
            name,
            value,
            ...cookieOptions,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...cookieOptions,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the cookies for the request and response
          const cookieOptions = {
            ...options,
            ...(process.env.NODE_ENV === "production" && {
              domain: process.env.NEXT_PUBLIC_SITE_URL
                ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
                : undefined,
              secure: true,
            }),
            sameSite: "lax" as const,
          };

          request.cookies.set({
            name,
            value: "",
            ...cookieOptions,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...cookieOptions,
          });
        },
      },
    }
  );
  return { supabase, response };
};

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = {
              ...options,
              domain:
                process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL
                  ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
                  : undefined,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax" as const,
            };
            supabaseResponse.cookies.set(name, value, cookieOptions);
          });
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  // This call automatically refreshes the session/token if needed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow public access to these routes
  const publicRoutes = [
    "/",
    "/login",
    "/signup",
    "/auth",
    "/pricing",
    "/terms",
    "/privacy",
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Protect dashboard and onboarding routes
  if (
    !user &&
    !isPublicRoute &&
    (request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/onboarding"))
  ) {
    // no user, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
};

