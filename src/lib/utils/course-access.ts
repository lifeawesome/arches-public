import { createClient } from "@/utils/supabase/client";
import { Course, getLessonId, getModuleId } from "@/types/course";

const supabase = createClient();

export interface CourseAccessResult {
  hasAccess: boolean;
  reason?: "free" | "enrolled" | "preview" | "no_access";
  message?: string;
}

export async function checkCourseAccess(
  course: Course,
  lessonId?: string
): Promise<CourseAccessResult> {
  try {
    // Free courses are always accessible
    if (course.isFree) {
      return {
        hasAccess: true,
        reason: "free",
        message: "This is a free course",
      };
    }

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        hasAccess: false,
        reason: "no_access",
        message: "Please sign in to access this course",
      };
    }

    // Check if user is enrolled in the course
    const { data: enrollment, error } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course._id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error checking course enrollment:", error);
      return {
        hasAccess: false,
        reason: "no_access",
        message: "Error checking enrollment status",
      };
    }

    if (enrollment) {
      return {
        hasAccess: true,
        reason: "enrolled",
        message: "You are enrolled in this course",
      };
    }

    // Check if this is a preview lesson
    if (lessonId && course.previewContent) {
      const isPreviewLesson = course.modules.some((module) =>
        module.lessons.some(
          (lesson) => getLessonId(lesson) === lessonId && lesson.isPreview
        )
      );

      if (isPreviewLesson) {
        return {
          hasAccess: true,
          reason: "preview",
          message: "This is a preview lesson",
        };
      }
    }

    // Check if the first module/lesson is previewable
    if (course.previewContent && course.modules.length > 0) {
      const firstModule = course.modules[0];
      if (firstModule.lessons.length > 0) {
        const firstLesson = firstModule.lessons[0];
        if (lessonId === getLessonId(firstLesson)) {
          return {
            hasAccess: true,
            reason: "preview",
            message: "This is a preview lesson",
          };
        }
      }
    }

    // No access
    return {
      hasAccess: false,
      reason: "no_access",
      message: "Please enroll in this course to access the content",
    };
  } catch (error) {
    console.error("Error checking course access:", error);
    return {
      hasAccess: false,
      reason: "no_access",
      message: "An error occurred while checking access",
    };
  }
}

export async function checkModuleAccess(
  course: Course,
  moduleId: string
): Promise<CourseAccessResult> {
  try {
    // Free courses are always accessible
    if (course.isFree) {
      return {
        hasAccess: true,
        reason: "free",
        message: "This is a free course",
      };
    }

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        hasAccess: false,
        reason: "no_access",
        message: "Please sign in to access this course",
      };
    }

    // Check if user is enrolled in the course
    const { data: enrollment, error } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course._id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      console.error("Error checking course enrollment:", error);
      return {
        hasAccess: false,
        reason: "no_access",
        message: "Error checking enrollment status",
      };
    }

    if (enrollment) {
      return {
        hasAccess: true,
        reason: "enrolled",
        message: "You are enrolled in this course",
      };
    }

    // Check if this module is previewable
    const currentModule = course.modules.find((m) => getModuleId(m) === moduleId);
    if (currentModule && currentModule.isPreview) {
      return {
        hasAccess: true,
        reason: "preview",
        message: "This is a preview module",
      };
    }

    // Check if this is the first module and course allows preview
    if (course.previewContent && course.modules.length > 0) {
      const firstModule = course.modules[0];
      if (getModuleId(firstModule) === moduleId) {
        return {
          hasAccess: true,
          reason: "preview",
          message: "This is a preview module",
        };
      }
    }

    // No access
    return {
      hasAccess: false,
      reason: "no_access",
      message: "Please enroll in this course to access the content",
    };
  } catch (error) {
    console.error("Error checking module access:", error);
    return {
      hasAccess: false,
      reason: "no_access",
      message: "An error occurred while checking access",
    };
  }
}
