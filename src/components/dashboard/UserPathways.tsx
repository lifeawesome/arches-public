"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import type { UserPathway } from "@/lib/pathways/queries";
import { getPathwayImageUrl } from "@/lib/utils/pathway-image";
import { unenrollFromPathway } from "@/lib/pathways/queries";
import { createClient } from "@/utils/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/Toasts/use-toast";

interface UserPathwaysProps {
  userPathways: UserPathway[];
  onUnenroll?: () => void;
}

export default function UserPathways({ 
  userPathways, 
  onUnenroll 
}: UserPathwaysProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pathwayToUnenroll, setPathwayToUnenroll] = useState<{
    pathwayId: string;
    userId: string;
    pathwayTitle: string;
  } | null>(null);

  if (userPathways.length === 0) {
    return null;
  }

  const handleUnenrollClick = (
    e: React.MouseEvent,
    pathwayId: string,
    userId: string,
    pathwayTitle: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setPathwayToUnenroll({ pathwayId, userId, pathwayTitle });
    setDialogOpen(true);
  };

  const handleUnenrollConfirm = async () => {
    if (!pathwayToUnenroll) return;

    const { pathwayId, userId } = pathwayToUnenroll;
    setUnenrollingId(pathwayId);
    setDialogOpen(false);

    try {
      await unenrollFromPathway(supabase, userId, pathwayId, false);
      if (onUnenroll) {
        onUnenroll();
      }
      toast({
        title: "Successfully unenrolled",
        description: `You have been unenrolled from ${pathwayToUnenroll.pathwayTitle}.`,
      });
    } catch (error) {
      console.error("Failed to unenroll:", error);
      toast({
        title: "Failed to unenroll",
        description:
          error instanceof Error
            ? error.message
            : "Failed to unenroll from pathway. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUnenrollingId(null);
      setPathwayToUnenroll(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "active":
        return "bg-primary/10 text-primary";
      case "paused":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Your Active Pathways</h2>
          <Link
            href="/pathways"
            className="text-sm font-medium text-primary hover:underline"
          >
            Explore More →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {userPathways.map((userPathway) => {
            const pathway = userPathway.pathway;
            if (!pathway) return null;

            const resolvedImageUrl = getPathwayImageUrl(pathway.cover_image_url);

            return (
              <div
                key={userPathway.id}
                className="group relative flex flex-col overflow-hidden rounded-lg border-2 border-border bg-background transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <Link
                  href={`/pathways/${pathway.slug}`}
                  className="flex flex-1 flex-col"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-muted">
                    <Image
                      src={resolvedImageUrl}
                      alt={pathway.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized={
                        resolvedImageUrl.includes("127.0.0.1") ||
                        resolvedImageUrl.includes("localhost") ||
                        resolvedImageUrl.includes("supabase") ||
                        resolvedImageUrl.startsWith("data:")
                      }
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold">{pathway.title}</h3>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                          userPathway.status
                        )}`}
                      >
                        {userPathway.status}
                      </span>
                    </div>
                    {pathway.summary && (
                      <p className="mb-4 flex-1 text-sm text-muted-foreground">
                        {pathway.summary}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Started {new Date(userPathway.started_at).toLocaleDateString()}
                      </span>
                      <span className="group-hover:text-primary">Continue →</span>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={(e) =>
                    handleUnenrollClick(
                      e,
                      userPathway.pathway_id,
                      userPathway.user_id,
                      pathway.title
                    )
                  }
                  disabled={unenrollingId === userPathway.pathway_id}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                  title="Unenroll from pathway"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unenroll from Pathway</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unenroll from{" "}
              <strong>{pathwayToUnenroll?.pathwayTitle}</strong>? Your progress
              will be preserved, but you won't receive new tasks from this
              pathway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenrollConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unenroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

