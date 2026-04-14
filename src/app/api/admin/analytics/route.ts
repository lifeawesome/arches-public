import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAdmin } from "@/utils/auth/roles";

export interface AnalyticsData {
  overview: {
    totalMembers: number;
    activeSubscriptions: number;
    monthlyActiveUsers: number;
    totalRevenue: number;
    growthRate: number;
  };
  memberGrowth: {
    date: string;
    members: number;
    newMembers: number;
  }[];
  subscriptionBreakdown: {
    status: string;
    count: number;
    percentage: number;
  }[];
  contentPerformance: {
    blogs: {
      title: string;
      slug: string;
      views?: number;
    }[];
    courses: {
      title: string;
      slug: string;
      enrollments?: number;
    }[];
    events: {
      title: string;
      slug: string;
      registrations?: number;
    }[];
  };
  topExperts: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    messageCount: number;
    profileViews?: number;
  }[];
  messagingActivity: {
    date: string;
    messages: number;
    conversations: number;
  }[];
  recentActivity: {
    type: "signup" | "subscription" | "cancellation" | "message";
    description: string;
    timestamp: string;
    userEmail?: string;
  }[];
}

/**
 * GET /api/admin/analytics
 * Fetch comprehensive analytics data
 * Query params: timeframe (7d, 30d, 90d, all)
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get("timeframe") || "30d";

    const supabase = await createClient();

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (timeframe) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "all":
        startDate = new Date("2020-01-01");
        break;
    }

    // 1. OVERVIEW METRICS
    const { count: totalMembers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: activeSubscriptions } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("subscription_status", ["active", "trialing"]);

    // Get previous period for growth rate
    const previousDate = new Date(startDate);
    previousDate.setDate(
      previousDate.getDate() -
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const { count: previousMembers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .lt("created_at", startDate.toISOString());

    const growthRate = previousMembers
      ? ((totalMembers! - previousMembers) / previousMembers) * 100
      : 0;

    // 2. MEMBER GROWTH OVER TIME
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    // Aggregate by date
    const memberGrowthMap = new Map<string, number>();
    let cumulativeCount = previousMembers || 0;

    allProfiles?.forEach((profile) => {
      const date = new Date(profile.created_at).toISOString().split("T")[0];
      memberGrowthMap.set(date, (memberGrowthMap.get(date) || 0) + 1);
    });

    const memberGrowth = Array.from(memberGrowthMap.entries())
      .map(([date, newMembers]) => {
        cumulativeCount += newMembers;
        return {
          date,
          members: cumulativeCount,
          newMembers,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // 3. SUBSCRIPTION BREAKDOWN
    const { data: subscriptionData } = await supabase
      .from("profiles")
      .select("subscription_status");

    const subscriptionCounts: Record<string, number> = {};
    subscriptionData?.forEach((profile) => {
      const status = profile.subscription_status || "free";
      subscriptionCounts[status] = (subscriptionCounts[status] || 0) + 1;
    });

    const subscriptionBreakdown = Object.entries(subscriptionCounts).map(
      ([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        percentage: (count / (totalMembers || 1)) * 100,
      })
    );

    // 4. MESSAGING ACTIVITY
    const { data: conversations } = await supabase
      .from("conversations")
      .select("created_at, updated_at")
      .gte("created_at", startDate.toISOString());

    const messagingActivityMap = new Map<
      string,
      { messages: number; conversations: number }
    >();

    conversations?.forEach((conv) => {
      const date = new Date(conv.created_at).toISOString().split("T")[0];
      const current = messagingActivityMap.get(date) || {
        messages: 0,
        conversations: 0,
      };
      current.conversations += 1;
      messagingActivityMap.set(date, current);
    });

    const messagingActivity = Array.from(messagingActivityMap.entries())
      .map(([date, data]) => ({
        date,
        messages: data.messages,
        conversations: data.conversations,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 5. TOP EXPERTS (by message count)
    const { data: expertsData } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("is_expert", true)
      .limit(10);

    // Get message counts for experts
    const topExperts = await Promise.all(
      (expertsData || []).map(async (expert) => {
        const { count: messageCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .or(
            `participant_1_id.eq.${expert.id},participant_2_id.eq.${expert.id}`
          );

        return {
          id: expert.id,
          name: expert.full_name || "Unknown",
          email: expert.email || "",
          avatar_url: expert.avatar_url,
          messageCount: messageCount || 0,
        };
      })
    );

    // Sort by message count
    topExperts.sort((a, b) => b.messageCount - a.messageCount);

    // 6. RECENT ACTIVITY
    const { data: recentMembers } = await supabase
      .from("profiles")
      .select("email, updated_at, subscription_status")
      .order("updated_at", { ascending: false })
      .limit(10);

    const recentActivity = (recentMembers || []).map((member) => ({
      type: "signup" as const,
      description: `Member activity: ${member.email}`,
      timestamp: member.updated_at,
      userEmail: member.email,
    }));

    // 7. CONTENT PERFORMANCE (placeholder - requires Sanity integration)
    const contentPerformance = {
      blogs: [] as { title: string; slug: string; views?: number }[],
      courses: [] as { title: string; slug: string; enrollments?: number }[],
      events: [] as { title: string; slug: string; registrations?: number }[],
    };

    const analyticsData: AnalyticsData = {
      overview: {
        totalMembers: totalMembers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        monthlyActiveUsers: 0, // TODO: Track this with actual activity
        totalRevenue: 0, // TODO: Calculate from Stripe
        growthRate: Number(growthRate.toFixed(1)),
      },
      memberGrowth,
      subscriptionBreakdown,
      contentPerformance,
      topExperts: topExperts.slice(0, 5),
      messagingActivity,
      recentActivity,
    };

    return NextResponse.json(analyticsData);
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics", details: (error as Error).message },
      { status: 500 }
    );
  }
}

