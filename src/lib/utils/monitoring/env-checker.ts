/**
 * Environment Variable Checker
 * 
 * Checks for missing or incorrect environment variables that could cause 429 errors
 */

export interface EnvCheckResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  info: Record<string, string>;
}

export function checkEnvironment(): EnvCheckResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const info: Record<string, string> = {};

  // Check Node Environment
  const nodeEnv = process.env.NODE_ENV;
  info.NODE_ENV = nodeEnv || "NOT SET";
  if (!nodeEnv) {
    issues.push("NODE_ENV is not set");
  } else if (nodeEnv !== "production" && nodeEnv !== "development") {
    warnings.push(`NODE_ENV is "${nodeEnv}" (expected "production" or "development")`);
  }

  // Check Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  info.SUPABASE_URL = supabaseUrl
    ? `${supabaseUrl.substring(0, 30)}...`
    : "NOT SET";
  if (!supabaseUrl) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  } else {
    // Check if it's a production URL
    if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1")) {
      warnings.push(
        "NEXT_PUBLIC_SUPABASE_URL appears to be a local URL (should be production in production)"
      );
    }
    // Check if it matches expected project
    if (!supabaseUrl.includes("qqwqwnleqvxzijyzzjhc")) {
      warnings.push(
        "NEXT_PUBLIC_SUPABASE_URL doesn't match expected project ID"
      );
    }
  }

  // Check Supabase Anon Key
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  info.HAS_ANON_KEY = supabaseAnonKey ? "YES" : "NO";
  if (!supabaseAnonKey) {
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  } else {
    // Check key format (anon keys start with eyJ...)
    if (!supabaseAnonKey.startsWith("eyJ")) {
      warnings.push(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY doesn't appear to be a valid JWT"
      );
    }
  }

  // Check Site URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  info.SITE_URL = siteUrl || "NOT SET";
  if (!siteUrl) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL is not set (may cause cookie domain issues)"
    );
  } else {
    // Check if it's a production URL
    if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
      warnings.push(
        "NEXT_PUBLIC_SITE_URL appears to be a local URL (should be production domain)"
      );
    }
  }

  // Check if we're in browser vs server
  if (typeof window !== "undefined") {
    info.RUNTIME = "browser";
    info.USER_AGENT = navigator.userAgent.substring(0, 50);
  } else {
    info.RUNTIME = "server";
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    info,
  };
}

/**
 * Get environment check results formatted for console
 */
export function logEnvironmentCheck() {
  const result = checkEnvironment();

  console.group("🔍 Environment Check");
  
  if (result.isValid) {
    console.log("✅ Environment configuration is valid");
  } else {
    console.error("❌ Environment configuration has issues:");
    result.issues.forEach((issue) => console.error(`  - ${issue}`));
  }

  if (result.warnings.length > 0) {
    console.warn("⚠️ Warnings:");
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  console.log("📋 Info:");
  Object.entries(result.info).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  console.groupEnd();

  return result;
}

