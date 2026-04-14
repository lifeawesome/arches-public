import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // EMERGENCY: Disable auto-refresh on server side too
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: true,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
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
              cookieStore.set(name, value, cookieOptions);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
