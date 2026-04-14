import { createClient } from "@/utils/supabase/client";

export type SaveItemType = "expert" | "offer" | "circle" | "post" | "event";

interface SaveItemParams {
  userId: string;
  itemType: SaveItemType;
  itemId: string;
  itemData?: {
    slug?: string;
    title?: string;
    startDate?: string;
  };
  notes?: string;
}

interface UnsaveItemParams {
  userId: string;
  itemType: SaveItemType;
  itemId: string;
}

interface CheckSavedStatusParams {
  userId: string;
  itemType: SaveItemType;
  itemId: string;
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

/**
 * Save an item for the user
 */
export async function saveItem({
  userId,
  itemType,
  itemId,
  itemData,
  notes,
}: SaveItemParams): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const tableName = TABLE_MAP[itemType];
  const columnName = COLUMN_MAP[itemType];

  try {
    const insertData: any = {
      user_id: userId,
      [columnName]: itemId,
    };

    if (notes) {
      insertData.notes = notes;
    }

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

    if (error) {
      console.error(`Error saving ${itemType}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error(`Error in saveItem:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Unsave an item for the user
 */
export async function unsaveItem({
  userId,
  itemType,
  itemId,
}: UnsaveItemParams): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const tableName = TABLE_MAP[itemType];
  const columnName = COLUMN_MAP[itemType];

  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("user_id", userId)
      .eq(columnName, itemId);

    if (error) {
      console.error(`Error unsaving ${itemType}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error(`Error in unsaveItem:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Check if an item is saved by the user
 */
export async function checkSavedStatus({
  userId,
  itemType,
  itemId,
}: CheckSavedStatusParams): Promise<{ isSaved: boolean; error?: string }> {
  const supabase = createClient();
  const tableName = TABLE_MAP[itemType];
  const columnName = COLUMN_MAP[itemType];

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("id")
      .eq("user_id", userId)
      .eq(columnName, itemId)
      .maybeSingle();

    if (error) {
      console.error(`Error checking saved status:`, error);
      return { isSaved: false, error: error.message };
    }

    return { isSaved: !!data };
  } catch (err) {
    console.error(`Error in checkSavedStatus:`, err);
    return {
      isSaved: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get all saved items for a user by type
 */
export async function getSavedItems(
  userId: string,
  itemType: SaveItemType,
  options?: { limit?: number; offset?: number }
) {
  const supabase = createClient();
  const tableName = TABLE_MAP[itemType];

  try {
    let query = supabase
      .from(tableName)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error getting saved ${itemType}s:`, error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    console.error(`Error in getSavedItems:`, err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get total count of saved items for a user
 */
export async function getSavedItemsCount(userId: string) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.rpc("get_user_saved_items_count", {
      p_user_id: userId,
    });

    if (error) {
      console.error("Error getting saved items count:", error);
      return {
        total_count: 0,
        experts_count: 0,
        offers_count: 0,
        circles_count: 0,
        posts_count: 0,
        events_count: 0,
        error: error.message,
      };
    }

    return { ...data[0], error: null };
  } catch (err) {
    console.error("Error in getSavedItemsCount:", err);
    return {
      total_count: 0,
      experts_count: 0,
      offers_count: 0,
      circles_count: 0,
      posts_count: 0,
      events_count: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}












