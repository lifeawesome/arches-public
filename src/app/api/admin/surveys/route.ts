import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";
import { SurveyFormData } from "@/types/survey";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin access
    const profile = await getAppRBACProfile(supabase, user.id);
    if (!profile || !hasAppAccessLevel(profile.app_access_level, "administrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all surveys
    const { data: surveys, error: surveysError } = await supabase
      .from("surveys")
      .select("*")
      .order("created_at", { ascending: false });

    if (surveysError) {
      console.error("Error fetching surveys:", surveysError);
      return NextResponse.json(
        { error: "Failed to fetch surveys" },
        { status: 500 }
      );
    }

    // Fetch stats for each survey
    const surveysWithStats = await Promise.all(
      (surveys || []).map(async (survey) => {
        // Get stats using the database function
        const { data: stats, error: statsError } = await supabase.rpc(
          "get_survey_stats",
          { p_survey_id: survey.id }
        );

        if (statsError) {
          console.error(`Error fetching stats for survey ${survey.id}:`, statsError);
          return {
            ...survey,
            target_audience: survey.target_audience || { type: "all" },
            stats: {
              total_sent: 0,
              total_views: 0,
              total_responses: 0,
              total_completed: 0,
              response_rate: 0,
              completion_rate: 0,
            },
          };
        }

        const statsRow = stats?.[0] || {
          total_sent: 0,
          total_views: 0,
          total_responses: 0,
          total_completed: 0,
          response_rate: 0,
          completion_rate: 0,
        };

        return {
          ...survey,
          target_audience: survey.target_audience || { type: "all" },
          stats: {
            total_sent: statsRow.total_sent || 0,
            total_views: statsRow.total_views || 0,
            total_responses: statsRow.total_responses || 0,
            total_completed: statsRow.total_completed || 0,
            response_rate: Number(statsRow.response_rate) || 0,
            completion_rate: Number(statsRow.completion_rate) || 0,
          },
        };
      })
    );

    return NextResponse.json({
      surveys: surveysWithStats,
      total: surveysWithStats.length,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/surveys:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin access
    const profile = await getAppRBACProfile(supabase, user.id);
    if (!profile || !hasAppAccessLevel(profile.app_access_level, "administrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: SurveyFormData = await request.json();
    const { title, description, status, target_audience, delivery_method, closes_at, questions } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required" },
        { status: 400 }
      );
    }

    // Create the survey
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        title: title.trim(),
        description: description || null,
        status: status || "draft",
        created_by: user.id,
        target_audience: target_audience || { type: "all" },
        delivery_method: delivery_method || ["in_app"],
        closes_at: closes_at || null,
      })
      .select()
      .single();

    if (surveyError) {
      console.error("Error creating survey:", surveyError);
      return NextResponse.json(
        { error: "Failed to create survey", details: surveyError.message },
        { status: 500 }
      );
    }

    // Create the questions
    const questionsToInsert = questions.map((q, index) => ({
      survey_id: survey.id,
      order_index: index,
      type: q.type,
      question_text: q.question_text,
      options: q.options || {},
      is_required: q.is_required || false,
      conditional_logic: q.conditional_logic || null,
    }));

    const { error: questionsError } = await supabase
      .from("survey_questions")
      .insert(questionsToInsert);

    if (questionsError) {
      console.error("Error creating questions:", questionsError);
      // Rollback: delete the survey if questions fail
      await supabase.from("surveys").delete().eq("id", survey.id);
      return NextResponse.json(
        { error: "Failed to create questions", details: questionsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...survey,
      target_audience: survey.target_audience || { type: "all" },
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/admin/surveys:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}



