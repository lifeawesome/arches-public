"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, MessageSquare } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/utils/supabase/client";

export default function TeamPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        // TODO: Implement Dream Team connections query
        // For now, show placeholder
        setConnections([]);
      } catch (error) {
        console.error("Error fetching connections:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConnections();
  }, [supabase]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Dream Team</h1>
            <p className="text-muted-foreground">
              Connect with experts and build your support network.
            </p>
          </div>

          {/* Connections */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Connections</h2>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <UserPlus className="h-4 w-4" />
                Add Connection
              </button>
            </div>

            {connections.length > 0 ? (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between rounded-lg border-2 border-border bg-muted/30 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted" />
                      <div>
                        <p className="font-medium">{connection.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {connection.expertise}
                        </p>
                      </div>
                    </div>
                    <button className="rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 font-semibold">No connections yet</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Start building your Dream Team by connecting with other experts.
                </p>
                <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                  <UserPlus className="h-4 w-4" />
                  Find Experts
                </button>
              </div>
            )}
          </div>

          {/* Social Feed Placeholder */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <h2 className="mb-4 text-xl font-semibold">Celebrations Feed</h2>
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Social feed coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}



