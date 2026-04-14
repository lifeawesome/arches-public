import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types_db";
import { trackClientCreation } from "@/utils/monitoring/client-instance-tracker";

// Use global variable instead of module-level to survive hot reloads and code splitting
// Next.js code splitting can create separate module scopes, so we need a true global
const GLOBAL_CLIENT_KEY = '__ARCHES_SUPABASE_CLIENT__';

function getGlobalClient(): ReturnType<typeof createBrowserClient<Database>> | null {
  if (typeof window === "undefined") return null;
  return (window as any)[GLOBAL_CLIENT_KEY] || null;
}

function setGlobalClient(client: ReturnType<typeof createBrowserClient<Database>>): void {
  if (typeof window !== "undefined") {
    (window as any)[GLOBAL_CLIENT_KEY] = client;
  }
}

export function createClient() {
  // Check global first (survives hot reloads and code splitting)
  const existingClient = getGlobalClient();
  if (existingClient) {
    return existingClient;
  }

  // Create new instance only once
  const newClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // RE-ENABLED: With singleton pattern, only one client instance exists
        // This prevents multiple simultaneous refresh attempts that caused 429 errors
        // The singleton ensures all components share the same client and refresh coordination
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Removed storageKey - use default to preserve existing sessions
        // The default key allows createBrowserClient to read from cookies and sync to localStorage
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    }
  );

  // Track ONLY when we actually create a new instance (pass client for identity tracking)
  if (typeof window !== "undefined") {
    trackClientCreation(newClient);
  }

  // Store in global to survive module re-evaluation
  setGlobalClient(newClient);

  return newClient;
}
