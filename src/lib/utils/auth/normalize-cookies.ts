/**
 * Normalize Supabase cookies to prevent duplicate cookies for localhost/127.0.0.1
 * 
 * In development, accessing the site via both localhost and 127.0.0.1 can create
 * duplicate cookies. This utility ensures only one set of cookies exists.
 */

export function normalizeSupabaseCookies() {
  if (typeof window === "undefined") return;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (!isLocalhost) {
    // Not localhost - no normalization needed
    return;
  }

  // Get all cookies
  const cookies = document.cookie.split(";");
  
  // Find Supabase auth cookies
  const supabaseCookies: Array<{ name: string; value: string }> = [];
  cookies.forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    const value = valueParts.join("="); // Rejoin in case value contains =
    
    if (name && name.startsWith("sb-") && name.includes("auth-token")) {
      supabaseCookies.push({ name, value });
    }
  });

  // If we have multiple cookies with the same name (different domains), keep only the current domain's
  const cookieNames = new Set(supabaseCookies.map(c => c.name));
  
  cookieNames.forEach((cookieName) => {
    const duplicates = supabaseCookies.filter(c => c.name === cookieName);
    
    if (duplicates.length > 1) {
      // Multiple cookies with same name - keep the one for current domain, delete others
      const currentDomainCookie = duplicates.find((_, index) => {
        // The cookie for the current domain should be the one that's accessible
        // We'll keep the first one and delete others by clearing with their domains
        return index === 0;
      });

      // Clear cookies for the other domain (localhost vs 127.0.0.1)
      const otherDomain = hostname === "localhost" ? "127.0.0.1" : "localhost";
      
      // Delete cookie for the other domain
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${otherDomain}`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      
      // Re-set the cookie for current domain to ensure it's properly set
      if (currentDomainCookie) {
        document.cookie = `${cookieName}=${currentDomainCookie.value}; path=/; SameSite=Lax`;
      }
    }
  });
}

// Auto-normalize on load in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Run after a short delay to ensure cookies are loaded
  setTimeout(normalizeSupabaseCookies, 100);
  
  // Also run on focus in case user switched between localhost/127.0.0.1
  window.addEventListener("focus", normalizeSupabaseCookies);
}

