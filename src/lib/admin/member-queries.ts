// Admin queries for member management

export type Member = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null; // Old app: admin, moderator, member
  app_access_level: string | null; // New app: user, manager, administrator
  subscription_tier: string | null; // Old app: explorer, builder, pro, partner
  app_subscription_tier: string | null; // New app: explorer, practitioner, professional, established
  subscription_status: string | null;
  next_billing_date: string | null;
  updated_at: string;
  created_at: string;
};

export type MemberFilters = {
  search?: string;
  role?: string;
  subscription?: string;
};

export type SortField = "name" | "role" | "subscription" | "last_updated";
export type SortDirection = "asc" | "desc";

/**
 * Get all members with filters and sorting
 */
export async function getMembers(
  client: any,
  options: {
    filters?: MemberFilters;
    sortField?: SortField;
    sortDirection?: SortDirection;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{
  members: Member[];
  total: number;
  filtered: number;
}> {
  const {
    filters = {},
    sortField = "last_updated",
    sortDirection = "desc",
    page = 1,
    pageSize = 50,
  } = options;

  let query = client.from("profiles").select("*", { count: "exact" });

  // Apply search filter
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    // Use or() with proper Supabase syntax
    query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
  }

  // Apply role filter
  if (filters.role) {
    if (filters.role === "admin" || filters.role === "moderator" || filters.role === "member") {
      query = query.eq("role", filters.role);
    } else if (filters.role === "administrator" || filters.role === "manager" || filters.role === "user") {
      query = query.eq("app_access_level", filters.role);
    }
  }

  // Apply subscription filter
  if (filters.subscription) {
    if (filters.subscription === "Free") {
      query = query.or("subscription_status.is.null,subscription_status.eq.inactive");
    } else {
      query = query.eq("subscription_status", filters.subscription.toLowerCase());
    }
  }

  // Apply sorting
  let orderByField = "updated_at";
  if (sortField === "name") {
    orderByField = "full_name";
  } else if (sortField === "role") {
    orderByField = "app_access_level";
  } else if (sortField === "subscription") {
    orderByField = "subscription_status";
  } else if (sortField === "last_updated") {
    orderByField = "updated_at";
  }

  query = query.order(orderByField, { ascending: sortDirection === "asc" });

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  // Get total count (without filters for "Total")
  const { count: totalCount } = await client
    .from("profiles")
    .select("*", { count: "exact", head: true });

  return {
    members: (data || []).map((member: any) => ({
      id: member.id,
      email: member.email || "",
      full_name: member.full_name,
      avatar_url: member.avatar_url,
      role: member.role,
      app_access_level: member.app_access_level,
      subscription_tier: member.subscription_tier,
      app_subscription_tier: member.app_subscription_tier,
      subscription_status: member.subscription_status,
      next_billing_date: member.next_billing_date,
      updated_at: member.updated_at,
      created_at: member.created_at,
    })),
    total: totalCount || 0,
    filtered: count || 0,
  };
}

/**
 * Get a single member by ID
 */
export async function getMemberById(
  client: any,
  memberId: string
): Promise<Member | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", memberId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch member: ${error.message}`);
  }

  return {
    id: data.id,
    email: data.email || "",
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    role: data.role,
    app_access_level: data.app_access_level,
    subscription_tier: data.subscription_tier,
    app_subscription_tier: data.app_subscription_tier,
    subscription_status: data.subscription_status,
    next_billing_date: data.next_billing_date,
    updated_at: data.updated_at,
    created_at: data.created_at,
  };
}

