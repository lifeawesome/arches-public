"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import PathwayList from "@/components/pathways/PathwayList";
import UserPathways from "@/components/dashboard/UserPathways";
import { createClient } from "@/utils/supabase/client";
import {
  getAvailablePathways,
  getUserPathways,
  enrollInPathway,
} from "@/lib/pathways/queries";
import type { Pathway, UserPathway } from "@/lib/pathways/queries";

export default function PathsPage() {
  const [availablePathways, setAvailablePathways] = useState<Pathway[]>([]);
  const [userPathways, setUserPathways] = useState<UserPathway[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        setUserId(user.id);

        const [pathways, userPaths] = await Promise.all([
          getAvailablePathways(supabase),
          getUserPathways(supabase, user.id),
        ]);

        setAvailablePathways(pathways);
        setUserPathways(userPaths);
      } catch (error) {
        console.error("Error fetching pathways:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const handleSelectPathway = async (pathwayId: string) => {
    if (!userId) return;

    try {
      await enrollInPathway(supabase, userId, pathwayId, true);
      // Refresh user pathways
      const updated = await getUserPathways(supabase, userId);
      setUserPathways(updated);
    } catch (error) {
      console.error("Failed to enroll in pathway:", error);
      alert("Failed to enroll in pathway. Please try again.");
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-5xl space-y-8">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Your Pathways</h1>
            <p className="text-muted-foreground">
              Continue your journey or explore new growth paths.
            </p>
          </div>

          {/* Active Pathways */}
          {userPathways.length > 0 ? (
            <div>
              <h2 className="mb-4 text-xl font-semibold">Active Pathways</h2>
              <UserPathways
                userPathways={userPathways}
                onUnenroll={async () => {
                  if (userId) {
                    const updated = await getUserPathways(supabase, userId);
                    setUserPathways(updated);
                  }
                }}
              />
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="mb-4 text-muted-foreground">
                You haven&apos;t enrolled in any pathways yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Browse available pathways below to get started.
              </p>
            </div>
          )}

          {/* Available Pathways */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Explore Pathways</h2>
            </div>
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-64 animate-pulse rounded-lg border-2 border-border bg-muted"
                  />
                ))}
              </div>
            ) : (
              <PathwayList
                pathways={availablePathways}
                onSelectPathway={handleSelectPathway}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}



