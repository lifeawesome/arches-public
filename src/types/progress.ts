export interface CourseProgress {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
}

export interface CourseProgressSummary {
  course_id: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  last_accessed_at?: string;
}
