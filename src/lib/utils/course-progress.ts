import { createClient } from "@/utils/supabase/client";
import {
  CourseProgress,
  CourseEnrollment,
  CourseProgressSummary,
} from "@/types/progress";
import { getLessonId } from "@/types/course";

const supabase = createClient();

export async function markLessonComplete(
  courseId: string,
  lessonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    // First check if already completed to avoid unnecessary database call
    const completionCheck = await isLessonCompleted(courseId, lessonId);
    if (completionCheck.completed) {
      return { success: true }; // Already completed, return success
    }

    // Try to insert the completion record
    // If it already exists (duplicate key), we'll catch that and treat as success
    const { error } = await supabase.from("course_progress").insert({
      user_id: user.id,
      course_id: courseId,
      lesson_id: lessonId,
      completed_at: new Date().toISOString(),
    });

    if (error) {
      // Handle duplicate key error gracefully
      // PostgreSQL error code 23505 = unique_violation
      if (
        error.code === "23505" ||
        error.message?.includes("duplicate key") ||
        error.message?.includes("unique constraint") ||
        error.message?.includes("course_progress_user_id_lesson_id_key")
      ) {
        // Already exists, treat as success
        return { success: true };
      }
      console.error("Error marking lesson complete:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    // Handle duplicate key error in catch block as well
    if (
      error?.code === "23505" ||
      error?.message?.includes("duplicate key") ||
      error?.message?.includes("unique constraint")
    ) {
      return { success: true };
    }
    console.error("Error marking lesson complete:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getCourseProgress(
  courseId: string
): Promise<{ progress: CourseProgressSummary | null; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { progress: null, error: "User not authenticated" };
    }

    // Get completed lessons for this course
    // Use distinct to ensure each lesson is only counted once
    // Even if there are duplicate entries (shouldn't happen with unique constraint, but be safe)
    const { data: completedLessons, error: progressError } = await supabase
      .from("course_progress")
      .select("lesson_id, completed_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId);

    if (progressError) {
      console.error("Error fetching course progress:", progressError);
      return { progress: null, error: progressError.message };
    }

    // Count distinct lesson_ids to ensure each lesson is only counted once
    // Create a Set of unique lesson_ids
    const uniqueLessonIds = new Set(
      completedLessons?.map((item: any) => item.lesson_id) || []
    );
    const completedCount = uniqueLessonIds.size;

    // Get the most recent completion date
    const lastAccessed = completedLessons?.length
      ? completedLessons.reduce((latest: any, current: any) => {
          const latestDate = new Date(latest.completed_at || 0);
          const currentDate = new Date(current.completed_at || 0);
          return currentDate > latestDate ? current : latest;
        }).completed_at
      : undefined;

    return {
      progress: {
        course_id: courseId,
        total_lessons: 0, // This will be populated by the calling component
        completed_lessons: completedCount,
        progress_percentage: 0, // This will be calculated by the calling component
        last_accessed_at: lastAccessed,
      },
    };
  } catch (error) {
    console.error("Error getting course progress:", error);
    return { progress: null, error: "An unexpected error occurred" };
  }
}

export async function isLessonCompleted(
  courseId: string,
  lessonId: string
): Promise<{ completed: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { completed: false, error: "User not authenticated" };
    }

    const { data, error } = await supabase
      .from("course_progress")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error checking lesson completion:", error);
      return { completed: false, error: error.message };
    }

    return { completed: !!data };
  } catch (error) {
    console.error("Error checking lesson completion:", error);
    return { completed: false, error: "An unexpected error occurred" };
  }
}

/**
 * Find the next lesson in a course after the current lesson
 * Returns null if there is no next lesson (course is complete)
 */
export function findNextLesson(
  course: { modules: Array<{ lessons: Array<{ _id?: string; _key?: string }> }> },
  currentLessonId: string
): { lessonId: string; moduleIndex: number; lessonIndex: number } | null {
  // Flatten all lessons with their module and lesson indices
  const allLessons: Array<{
    lessonId: string;
    moduleIndex: number;
    lessonIndex: number;
  }> = [];

  course.modules.forEach((module, moduleIndex) => {
    module.lessons.forEach((lesson, lessonIndex) => {
      allLessons.push({
        lessonId: getLessonId(lesson as any),
        moduleIndex,
        lessonIndex,
      });
    });
  });

  // Find the current lesson index
  const currentIndex = allLessons.findIndex(
    (l) => l.lessonId === currentLessonId
  );

  // If current lesson not found, return null
  if (currentIndex === -1) {
    return null;
  }

  // If it's the last lesson in the course, return null
  if (currentIndex === allLessons.length - 1) {
    return null;
  }

  // Return the next lesson (which could be in the next module)
  return allLessons[currentIndex + 1];
}

export async function enrollInCourse(
  courseId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const { error } = await supabase.from("course_enrollments").upsert({
      user_id: user.id,
      course_id: courseId,
      enrolled_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error enrolling in course:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error enrolling in course:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function isEnrolledInCourse(
  courseId: string
): Promise<{ enrolled: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { enrolled: false, error: "User not authenticated" };
    }

    const { data, error } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error checking course enrollment:", error);
      return { enrolled: false, error: error.message };
    }

    return { enrolled: !!data };
  } catch (error) {
    console.error("Error checking course enrollment:", error);
    return { enrolled: false, error: "An unexpected error occurred" };
  }
}
