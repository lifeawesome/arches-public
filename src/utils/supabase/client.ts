import { createBrowserClient } from "@supabase/ssr";

// Use global variable to survive hot reloads and code splitting
const GLOBAL_CLIENT_KEY = "__ARCHES_SUPABASE_CLIENT__";

function getGlobalClient(): ReturnType<typeof createBrowserClient> | null {
  if (typeof window === "undefined") return null;
  return (window as any)[GLOBAL_CLIENT_KEY] || null;
}

function setGlobalClient(client: ReturnType<typeof createBrowserClient>): void {
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
  const newClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    }
  );

  // Store in global to survive module re-evaluation
  setGlobalClient(newClient);

  return newClient;
}

