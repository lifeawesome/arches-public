"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface UnreadData {
  count: number;
}

/**
 * Hook to fetch unread message count for the current user
 * @param pollInterval - Polling interval in milliseconds. If 0, polling is disabled.
 */
export function useUnreadMessages(pollInterval: number = 0) {
  const [unreadData, setUnreadData] = useState<UnreadData>({ count: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchUnreadCount = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUnreadData({ count: 0 });
        setLoading(false);
        return;
      }

      // Use the database function to get unread count
      const { data, error } = await supabase.rpc("get_unread_message_count", {
        user_id: user.id,
      });

      if (error) {
        console.error("Error fetching unread messages:", error);
        setUnreadData({ count: 0 });
      } else {
        setUnreadData({ count: data || 0 });
      }
    } catch (error) {
      console.error("Error in useUnreadMessages:", error);
      setUnreadData({ count: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchUnreadCount();

    // Set up polling if interval is provided
    if (pollInterval > 0) {
      const intervalId = setInterval(fetchUnreadCount, pollInterval);
      return () => clearInterval(intervalId);
    }
  }, [pollInterval, supabase]);

  return { unreadData, loading };
}

