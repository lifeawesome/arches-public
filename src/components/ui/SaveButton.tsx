"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/Toasts/use-toast";

type SaveItemType = "expert" | "offer" | "circle" | "post" | "event";

interface SaveButtonProps {
  itemType: SaveItemType;
  itemId: string;
  itemData?: {
    slug?: string;
    title?: string;
    startDate?: string;
  };
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showText?: boolean;
}

const TABLE_MAP: Record<SaveItemType, string> = {
  expert: "saved_experts",
  offer: "saved_offers",
  circle: "saved_circles",
  post: "saved_posts",
  event: "saved_events",
};

const COLUMN_MAP: Record<SaveItemType, string> = {
  expert: "expert_id",
  offer: "offer_id",
  circle: "circle_id",
  post: "post_id",
  event: "event_id",
};

const LABEL_MAP: Record<SaveItemType, { singular: string; plural: string }> = {
  expert: { singular: "Expert", plural: "Experts" },
  offer: { singular: "Offer", plural: "Offers" },
  circle: { singular: "Circle", plural: "Circles" },
  post: { singular: "Post", plural: "Posts" },
  event: { singular: "Event", plural: "Events" },
};

export function SaveButton({
  itemType,
  itemId,
  itemData,
  variant = "outline",
  size = "default",
  className = "",
  showText = true,
}: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const tableName = TABLE_MAP[itemType];
  const columnName = COLUMN_MAP[itemType];
  const label = LABEL_MAP[itemType];

  // Check if item is saved and get current user
  useEffect(() => {
    const checkSavedStatus = async () => {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setCurrentUserId(null);
          return;
        }

        setCurrentUserId(user.id);

        // Check if item is saved
        const { data, error } = await supabase
          .from(tableName)
          .select("id")
          .eq("user_id", user.id)
          .eq(columnName, itemId)
          .maybeSingle();

        if (error) {
          console.error("Error checking saved status:", error);
          return;
        }

        setIsSaved(!!data);
      } catch (err) {
        console.error("Error in checkSavedStatus:", err);
      }
    };

    checkSavedStatus();
  }, [itemId, itemType, supabase, tableName, columnName]);

  const handleToggleSave = async () => {
    if (!currentUserId) {
      toast({
        title: "Sign in required",
        description: `Please sign in to save ${label.plural.toLowerCase()}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      if (isSaved) {
        // Unsave the item
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("user_id", currentUserId)
          .eq(columnName, itemId);

        if (error) throw error;

        setIsSaved(false);
        toast({
          title: `${label.singular} removed`,
          description: `${label.singular} has been removed from your saved list`,
        });
      } else {
        // Save the item
        const insertData: any = {
          user_id: currentUserId,
          [columnName]: itemId,
        };

        // For events from Sanity CMS, add additional data
        if (itemType === "event" && itemData) {
          insertData.event_slug = itemData.slug || "";
          insertData.event_title = itemData.title || "";
          if (itemData.startDate) {
            insertData.event_start_date = itemData.startDate;
          }
        }

        const { error } = await supabase
          .from(tableName)
          .insert(insertData as never);

        if (error) throw error;

        setIsSaved(true);
        toast({
          title: `${label.singular} saved`,
          description: `${label.singular} has been added to your saved list`,
        });
      }
    } catch (err) {
      console.error("Error toggling save:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to update saved status",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      variant={isSaved ? "default" : variant}
      size={size}
      className={`${isSaved ? "bg-orange-500 hover:bg-orange-600" : ""} ${className}`}
      onClick={handleToggleSave}
      disabled={isSaving}
    >
      <Bookmark
        className={`h-4 w-4 ${showText ? "mr-2" : ""} ${isSaved ? "fill-current" : ""}`}
      />
      {showText &&
        (isSaving ? "Saving..." : isSaved ? "Saved" : `Save ${label.singular}`)}
    </Button>
  );
}












