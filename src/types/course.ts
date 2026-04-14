export interface Course {
  _id: string;
  _type: "course";
  title: string;
  slug: { current: string };
  description: string;
  instructor: {
    _id: string;
    _type: "author";
    name: string;
    image?: {
      asset: {
        _ref: string;
        _type: "reference";
      };
    };
  };
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedDuration: number;
  isFree: boolean;
  previewContent: boolean;
  price?: number;
  image?: {
    asset: {
      _ref: string;
      _type: "reference";
    };
    hotspot?: {
      x: number;
      y: number;
      height: number;
      width: number;
    };
  };
  modules: Module[];
  learningObjectives?: string[];
  prerequisites?: Course[];
  publishedAt: string;
}

// Module can be either a reference (with _id) or embedded (with _key)
export interface Module {
  // Reference-based modules have _id, embedded modules have _key
  _id?: string;
  _key?: string;
  _type: "module" | "moduleEmbedded";
  title: string;
  description?: string;
  order: number;
  lessons: Lesson[];
  isPreview: boolean;
}

// Lesson can be either a reference (with _id) or embedded (with _key)
export interface Lesson {
  // Reference-based lessons have _id, embedded lessons have _key
  _id?: string;
  _key?: string;
  _type: "lesson" | "lessonEmbedded";
  title: string;
  description?: string;
  order: number;
  content?: string;
  video?: {
    videoId: string;
    url: string;
    playbackUrl?: string;
    s3Key?: string;
    thumbnailS3Key?: string;
    thumbnailUrl?: string;
    duration?: number;
    status: "uploading" | "processing" | "ready" | "error";
    fileName: string;
    fileSize: number;
  };
  videoUrl?: string; // Legacy field - deprecated
  videoDuration?: number;
  estimatedDuration: number;
  isPreview: boolean;
  resources?: {
    title: string;
    url: string;
    type: "download" | "link" | "docs";
  }[];
}

// Helper function to get a unique identifier for a module (works with both _id and _key)
export function getModuleId(module: Module): string {
  return module._id || module._key || "";
}

// Helper function to get a unique identifier for a lesson (works with both _id and _key)
export function getLessonId(lesson: Lesson): string {
  return lesson._id || lesson._key || "";
}

export interface CourseProgress {
  courseId: string;
  userId: string;
  enrolledAt: string;
  status: "enrolled" | "in_progress" | "completed";
  currentLessonId?: string;
  progressPercentage: number;
  completedLessons: string[];
  lastAccessedAt: string;
}

export interface LessonProgress {
  lessonId: string;
  userId: string;
  completed: boolean;
  completedAt?: string;
  timeSpent: number;
  lastPosition?: number; // For videos
}
