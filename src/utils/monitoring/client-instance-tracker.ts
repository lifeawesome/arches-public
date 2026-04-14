/**
 * Client instance tracker - Stub implementation for build compatibility
 */

export function trackClientCreation(client: any): void {
  // Stub implementation - track client creation if needed
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("Supabase client created");
  }
}

