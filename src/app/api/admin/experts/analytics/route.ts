import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAdmin } from "@/utils/auth/roles";
import { Expert } from "@/types/expert";

export interface ExpertAnalyticsData {
  overview: {
    totalExperts: number;
    activeExperts: number;
    verifiedExperts: number;
    totalWorkRequests: number;
    pendingRequests: number;
    acceptedRequests: number;
  };
  skillsTagCloud: {
    skill: string;
    count: number;
    experts: number;
  }[];
  topExperts: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    expertise_area: string;
    total_skills: number;
    is_verified: boolean;
    message_count: number;
    profile_completeness_score: number;
  }[];
  recentWorkRequests: {
    id: string;
    project_title: string;
    project_type: string;
    client_name: string;
    expert_name: string;
    status: string;
    created_at: string;
    budget_min?: number;
    budget_max?: number;
  }[];
  expertiseDistribution: {
    expertise_area: string;
    count: number;
    percentage: number;
  }[];
}

/**
 * GET /api/admin/experts/analytics
 * Fetch comprehensive expert analytics data
 */
export async function GET() {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const supabase = await createClient();

    // 1. OVERVIEW METRICS
    const { count: totalExperts } = await supabase
      .from("experts")
      .select("*", { count: "exact", head: true });

    const { count: activeExperts } = await supabase
      .from("experts")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: verifiedExperts } = await supabase
      .from("experts")
      .select("*", { count: "exact", head: true })
      .eq("is_verified", true);

    const { count: totalWorkRequests } = await supabase
      .from("project_requests")
      .select("*", { count: "exact", head: true });

    const { count: pendingRequests } = await supabase
      .from("project_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: acceptedRequests } = await supabase
      .from("project_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "accepted");

    // 2. SKILLS TAG CLOUD
    const { data: expertsWithSkills } = await supabase
      .from("experts")
      .select("resume_skills")
      .not("resume_skills", "is", null);

    // Aggregate all skills
    const skillCounts = new Map<
      string,
      { count: number; experts: Set<string> }
    >();

    expertsWithSkills?.forEach((expert, expertIndex) => {
      const skills = expert.resume_skills || [];
      skills.forEach((skill: string) => {
        const normalizedSkill = skill.trim();
        if (!skillCounts.has(normalizedSkill)) {
          skillCounts.set(normalizedSkill, { count: 0, experts: new Set() });
        }
        const current = skillCounts.get(normalizedSkill)!;
        current.count += 1;
        current.experts.add(expertIndex.toString());
      });
    });

    // Convert to array and sort by count
    const skillsTagCloud = Array.from(skillCounts.entries())
      .map(([skill, data]) => ({
        skill,
        count: data.count,
        experts: data.experts.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50 skills

    // 3. EXPERTISE DISTRIBUTION
    const { data: expertiseData } = await supabase
      .from("experts")
      .select("expertise_area");

    const expertiseCounts: Record<string, number> = {};
    expertiseData?.forEach((expert) => {
      const area = expert.expertise_area || "Other";
      expertiseCounts[area] = (expertiseCounts[area] || 0) + 1;
    });

    const expertiseDistribution = Object.entries(expertiseCounts)
      .map(([expertise_area, count]) => ({
        expertise_area,
        count,
        percentage: (count / (totalExperts || 1)) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // 4. TOP EXPERTS
    const { data: topExpertsData } = await supabase
      .from("experts")
      .select(
        `
        id,
        user_id,
        expertise_area,
        resume_skills,
        is_verified,
        profile_completeness_score,
        profiles!inner(full_name, email, avatar_url)
      `
      )
      .eq("is_active", true)
      .order("profile_completeness_score", { ascending: false })
      .limit(10);

    // Get message counts for top experts
    const topExperts = await Promise.all(
      (topExpertsData || []).map(async (expert) => {
        const { count: messageCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .contains("participants", [(expert as unknown as Expert).user_id]);

        const profiles = (expert as unknown as Expert).profiles as { full_name?: string; email?: string; avatar_url?: string | null | undefined } | undefined;
        return {
          id: (expert as unknown as Expert).id,
          name: profiles?.full_name || "Unknown",
          email: profiles?.email || "",
          avatar_url: profiles?.avatar_url || null,
          expertise_area: (expert as unknown as Expert).expertise_area,
          total_skills: (expert as unknown as Expert).resume_skills?.length || 0,
          is_verified: (expert as unknown as Expert).is_verified,
          message_count: messageCount || 0,
          profile_completeness_score:
            (expert as unknown as Expert).profile_completeness_score || 0,
        };
      })
    );

    // Sort by profile completeness and message count
    topExperts.sort((a, b) => {
      if (b.profile_completeness_score !== a.profile_completeness_score) {
        return b.profile_completeness_score - a.profile_completeness_score;
      }
      return b.message_count - a.message_count;
    });

    // 5. RECENT WORK REQUESTS
    const { data: recentRequests } = await supabase
      .from("project_requests")
      .select(
        `
        id,
        project_title,
        project_type,
        status,
        created_at,
        budget_min,
        budget_max,
        client_id,
        expert_id
      `
      )
      .order("created_at", { ascending: false })
      .limit(10);

    // Get client and expert names
    type ProjectRequestData = {
      id: string;
      project_title: string;
      project_type: string | null;
      status: string;
      created_at: string;
      budget_min: number | null;
      budget_max: number | null;
      client_id: string;
      expert_id: string;
    };

    const recentWorkRequests = await Promise.all(
      (recentRequests || []).map(async (request: ProjectRequestData) => {
        const { data: clientProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", request.client_id)
          .single();

        const { data: expertProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", request.expert_id)
          .single();

        return {
          id: request.id,
          project_title: request.project_title,
          project_type: request.project_type || "General",
          client_name:
            (clientProfile as { full_name: string | null } | null)?.full_name ||
            "Unknown",
          expert_name:
            (expertProfile as { full_name: string | null } | null)?.full_name ||
            "Unknown",
          status: request.status,
          created_at: request.created_at,
          budget_min: request.budget_min ?? undefined,
          budget_max: request.budget_max ?? undefined,
        };
      })
    );

    const analyticsData: ExpertAnalyticsData = {
      overview: {
        totalExperts: totalExperts || 0,
        activeExperts: activeExperts || 0,
        verifiedExperts: verifiedExperts || 0,
        totalWorkRequests: totalWorkRequests || 0,
        pendingRequests: pendingRequests || 0,
        acceptedRequests: acceptedRequests || 0,
      },
      skillsTagCloud,
      topExperts: topExperts.slice(0, 10),
      recentWorkRequests,
      expertiseDistribution,
    };

    return NextResponse.json(analyticsData);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error in GET /api/admin/experts/analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch expert analytics", details: errorMessage },
      { status: 500 }
    );
  }
}
