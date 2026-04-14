"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { createClient } from "@/utils/supabase/client";
import { Plus, Edit, Trash2, Eye, ArrowLeft } from "lucide-react";
import type { Pathway } from "@/lib/pathways/queries";

export default function PathwaysAdminPage() {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchPathways = async () => {
      try {
        // First try to fetch all pathways (will work if user is admin)
        const { data, error } = await supabase
          .from("pathways")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching pathways:", error);
          console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          
          // If it's an RLS policy error, try fetching only active pathways
          if (error.code === '42501' || error.message.includes('policy')) {
            console.log("RLS policy error detected, trying active pathways only...");
            const { data: activeData, error: activeError } = await supabase
              .from("pathways")
              .select("*")
              .eq("is_active", true)
              .order("created_at", { ascending: false });
            
            if (activeError) {
              console.error("Error fetching active pathways:", activeError);
              setPathways([]);
            } else {
              setPathways(activeData || []);
            }
          } else {
            setPathways([]);
          }
        } else {
          setPathways(data || []);
        }
      } catch (error) {
        console.error("Error:", error);
        setPathways([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPathways();
  }, [supabase]);

  const handleDelete = async (pathwayId: string) => {
    if (!confirm("Are you sure you want to delete this pathway?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("pathways")
        .delete()
        .eq("id", pathwayId);

      if (error) {
        alert("Failed to delete pathway: " + error.message);
        return;
      }

      // Refresh list
      setPathways(pathways.filter((p) => p.id !== pathwayId));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete pathway");
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-muted-foreground">Loading pathways...</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">Manage Pathways</h1>
                <p className="text-muted-foreground">
                  Create, edit, and manage expert growth pathways
                </p>
              </div>
          <Link
            href="/admin/pathways/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Pathway
          </Link>
        </div>

        {/* Pathways List */}
        {pathways.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-background p-12 text-center">
            <p className="text-lg font-semibold mb-2">No pathways found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {isLoading 
                ? "Loading pathways..." 
                : "Create your first pathway to get started, or check if you need administrator access to view inactive pathways."
              }
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Note: If you created a pathway but don't see it here, you may need to set your app_access_level to 'administrator' in the database.
            </p>
            <Link
              href="/admin/pathways/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create First Pathway
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pathways.map((pathway) => (
              <div
                key={pathway.id}
                className="group rounded-lg border-2 border-border bg-background p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{pathway.title}</h3>
                    {pathway.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {pathway.summary}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                      pathway.is_active
                        ? "bg-green-500/10 text-green-700 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {pathway.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {pathway.estimated_days && (
                    <span>~{pathway.estimated_days} days</span>
                  )}
                  {pathway.difficulty && <span>Level {pathway.difficulty}</span>}
                  <span>v{pathway.version}</span>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/admin/pathways/${pathway.id}`}
                    className="flex-1 rounded-lg border-2 border-border bg-background px-3 py-2 text-center text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <Edit className="h-4 w-4 mx-auto" />
                  </Link>
                  <Link
                    href={`/admin/pathways/${pathway.id}/preview`}
                    className="rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(pathway.id)}
                    className="rounded-lg border-2 border-destructive/50 bg-background px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

