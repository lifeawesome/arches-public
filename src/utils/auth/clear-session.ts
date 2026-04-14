/**
 * Clear all Supabase session data including cookies and localStorage
 * This ensures a complete logout when signOut() doesn't clear cookies
 */

export function clearAllSessionData() {
  if (typeof window === "undefined") return;

  // Clear all Supabase localStorage keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("sb-") || key.startsWith("supabase."))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  // Clear avatar cache
  const avatarKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("avatar_url_")) {
      avatarKeys.push(key);
    }
  }
  avatarKeys.forEach((key) => localStorage.removeItem(key));

  // Clear all Supabase cookies
  // Supabase cookies follow the pattern: sb-{project-ref}-auth-token
  // We need to clear them with the correct domain and path
  // IMPORTANT: In development, cookies can exist for both localhost and 127.0.0.1
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  
  // Get all cookies
  const cookies = document.cookie.split(";");
  
  // Collect all Supabase cookie names
  const supabaseCookieNames = new Set<string>();
  cookies.forEach((cookie) => {
    const [name] = cookie.trim().split("=");
    if (name && name.startsWith("sb-") && name.includes("auth-token")) {
      supabaseCookieNames.add(name);
    }
  });
  
  // Clear each Supabase cookie with all possible domain/path combinations
  supabaseCookieNames.forEach((name) => {
    // In development, clear for both localhost and 127.0.0.1
    const domains = isLocalhost 
      ? ["localhost", "127.0.0.1", hostname, ""] // Clear for both localhost variants
      : [hostname, `.${hostname}`, ""]; // Production: try with and without dot prefix
    
    const paths = ["/", ""];
    
    domains.forEach((domain) => {
      paths.forEach((path) => {
        // Set cookie with expired date to delete it
        let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
        if (domain) {
          cookieString += `; domain=${domain}`;
        }
        document.cookie = cookieString;
      });
    });
  });

  // Also try to clear any cookies that might be set by Supabase SSR
  // These might have different naming patterns
  const supabaseCookiePatterns = [
    /^sb-.*-auth-token$/,
    /^sb-.*-access-token$/,
    /^sb-.*-refresh-token$/,
  ];

  supabaseCookiePatterns.forEach((pattern) => {
    cookies.forEach((cookie) => {
      const [name] = cookie.trim().split("=");
      if (name && pattern.test(name)) {
        const domains = isLocalhost 
          ? [hostname, ""]
          : [hostname, `.${hostname}`, ""];
        
        const paths = ["/", ""];
        
        domains.forEach((domain) => {
          paths.forEach((path) => {
            let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
            if (domain) {
              cookieString += `; domain=${domain}`;
            }
            document.cookie = cookieString;
          });
        });
      }
    });
  });

  // Clear the singleton client global
  (window as any).__ARCHES_SUPABASE_CLIENT__ = null;
}

