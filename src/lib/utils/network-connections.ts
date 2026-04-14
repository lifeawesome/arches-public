import { createClient } from "@/utils/supabase/client";
import type { Database } from "@/types_db";

type NetworkConnectionInsert =
  Database["public"]["Tables"]["network_connections"]["Insert"];
type MemberFollowInsert =
  Database["public"]["Tables"]["member_follows"]["Insert"];

export interface ConnectionStatus {
  isConnected: boolean;
  status: "pending" | "accepted" | "blocked" | null;
  isInitiator: boolean; // Whether current user initiated the connection
}

export interface FollowStatus {
  isFollowing: boolean;
}

/**
 * Check if a connection exists between two users
 */
export async function getConnectionStatus(
  currentUserId: string,
  otherUserId: string
): Promise<ConnectionStatus> {
  const supabase = createClient();

  // Check if current user initiated the connection
  const {
    data: initiatedConnection,
  }: { data: NetworkConnectionInsert | null } = await supabase
    .from("network_connections")
    .select("*")
    .eq("user_id", currentUserId)
    .eq("connected_user_id", otherUserId)
    .maybeSingle();

  if (initiatedConnection) {
    return {
      isConnected: true,
      status: initiatedConnection.status as "pending" | "accepted" | "blocked",
      isInitiator: true,
    };
  }

  // Check if other user initiated the connection
  const { data: receivedConnection }: { data: NetworkConnectionInsert | null } =
    await supabase
      .from("network_connections")
      .select("*")
      .eq("user_id", otherUserId)
      .eq("connected_user_id", currentUserId)
      .maybeSingle();

  if (receivedConnection) {
    return {
      isConnected: true,
      status: receivedConnection.status as "pending" | "accepted" | "blocked",
      isInitiator: false,
    };
  }

  return {
    isConnected: false,
    status: null,
    isInitiator: false,
  };
}

/**
 * Create a connection request (Add to Network)
 */
export async function addToNetwork(
  currentUserId: string,
  otherUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Check if connection already exists
    const existingStatus = await getConnectionStatus(
      currentUserId,
      otherUserId
    );
    if (existingStatus.isConnected) {
      return {
        success: false,
        error: "Connection already exists",
      };
    }

    const connection: NetworkConnectionInsert = {
      user_id: currentUserId,
      connected_user_id: otherUserId,
      status: "pending",
    };

    const { error } = await supabase
      .from("network_connections")
      .insert(connection as never);

    if (error) {
      console.error("Error adding to network:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in addToNetwork:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add to network",
    };
  }
}

/**
 * Accept a pending connection request
 */
export async function acceptConnection(
  currentUserId: string,
  otherUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Find the connection (other user initiated it)
    const { data: connection, error: findError } = await supabase
      .from("network_connections")
      .select("*")
      .eq("user_id", otherUserId)
      .eq("connected_user_id", currentUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (findError || !connection) {
      return {
        success: false,
        error: "Connection request not found",
      };
    }

    const { error } = await supabase
      .from("network_connections")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      } as never)
      .eq("id", (connection as unknown as { id: string }).id);

    if (error) {
      console.error("Error accepting connection:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in acceptConnection:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to accept connection",
    };
  }
}

/**
 * Remove a connection
 */
export async function removeConnection(
  currentUserId: string,
  otherUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Delete connection in either direction
    const { error: error1 } = await supabase
      .from("network_connections")
      .delete()
      .eq("user_id", currentUserId)
      .eq("connected_user_id", otherUserId);

    if (error1) {
      // Try the other direction
      const { error: error2 } = await supabase
        .from("network_connections")
        .delete()
        .eq("user_id", otherUserId)
        .eq("connected_user_id", currentUserId);

      if (error2) {
        console.error("Error removing connection:", error2);
        return {
          success: false,
          error: error2.message,
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error in removeConnection:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to remove connection",
    };
  }
}

/**
 * Check if current user is following another user
 */
export async function getFollowStatus(
  currentUserId: string,
  otherUserId: string
): Promise<FollowStatus> {
  const supabase = createClient();

  const { data } = await supabase
    .from("member_follows")
    .select("*")
    .eq("follower_id", currentUserId)
    .eq("following_id", otherUserId)
    .maybeSingle();

  return {
    isFollowing: !!data,
  };
}

/**
 * Follow a member
 */
export async function followMember(
  currentUserId: string,
  otherUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Check if already following
    const followStatus = await getFollowStatus(currentUserId, otherUserId);
    if (followStatus.isFollowing) {
      return {
        success: false,
        error: "Already following this member",
      };
    }

    const follow: MemberFollowInsert = {
      follower_id: currentUserId,
      following_id: otherUserId,
    };

    const { error } = await supabase
      .from("member_follows")
      .insert(follow as never);

    if (error) {
      console.error("Error following member:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in followMember:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to follow member",
    };
  }
}

/**
 * Unfollow a member
 */
export async function unfollowMember(
  currentUserId: string,
  otherUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("member_follows")
      .delete()
      .eq("follower_id", currentUserId)
      .eq("following_id", otherUserId);

    if (error) {
      console.error("Error unfollowing member:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in unfollowMember:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to unfollow member",
    };
  }
}
