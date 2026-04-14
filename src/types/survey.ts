import { Database } from "@/types_db";

// Database types
export type SurveyStatus = "draft" | "active" | "closed";
export type QuestionType =
  | "multiple_choice"
  | "checkboxes"
  | "text"
  | "long_text"
  | "rating"
  | "scale"
  | "matrix";

// Survey interfaces
export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  created_by: string;
  target_audience: TargetAudience;
  delivery_method: string[];
  published_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  order_index: number;
  type: QuestionType;
  question_text: string;
  options: QuestionOptions;
  is_required: boolean;
  conditional_logic: ConditionalLogic | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string | null;
  answers: Record<string, Answer>;
  completed_at: string | null;
  started_at: string;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyNotification {
  id: string;
  survey_id: string;
  user_id: string;
  sent_at: string;
  delivery_method: string;
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
}

// Target audience types
export type TargetAudienceType = "all" | "role" | "subscription_tier" | "custom";

export interface TargetAudience {
  type: TargetAudienceType;
  roles?: string[];
  tiers?: string[];
  user_ids?: string[];
}

// Question option types
export interface QuestionOptions {
  choices?: string[];
  min_rating?: number;
  max_rating?: number;
  min_label?: string;
  max_label?: string;
  scale_min?: number;
  scale_max?: number;
  scale_step?: number;
  rows?: string[];
  columns?: string[];
}

// Conditional logic types
export interface ConditionalLogic {
  show_if?: {
    question_id: string;
    operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
    value: string | number;
  };
}

// Answer types
export type Answer =
  | string // For text, long_text
  | string[] // For checkboxes, multi-select
  | number // For rating, scale
  | Record<string, string>; // For matrix questions

// Survey with relations
export interface SurveyWithQuestions extends Survey {
  questions: SurveyQuestion[];
}

export interface SurveyWithStats extends Survey {
  stats: SurveyStats;
}

// Statistics
export interface SurveyStats {
  total_sent: number;
  total_views: number;
  total_responses: number;
  total_completed: number;
  response_rate: number;
  completion_rate: number;
}

// Form state types
export interface SurveyFormData {
  title: string;
  description: string;
  status: SurveyStatus;
  target_audience: TargetAudience;
  delivery_method: string[];
  closes_at: string | null;
  questions: QuestionFormData[];
}

export interface QuestionFormData {
  id?: string;
  type: QuestionType;
  question_text: string;
  options: QuestionOptions;
  is_required: boolean;
  conditional_logic: ConditionalLogic | null;
}

// Response form data
export interface ResponseFormData {
  survey_id: string;
  answers: Record<string, Answer>;
}

// API response types
export interface SurveyListResponse {
  surveys: SurveyWithStats[];
  total: number;
}

export interface SurveyResultsResponse {
  survey: Survey;
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  stats: SurveyStats;
  analytics: QuestionAnalytics[];
}

export interface QuestionAnalytics {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  total_responses: number;
  breakdown: AnswerBreakdown[];
}

export interface AnswerBreakdown {
  value: string | number;
  count: number;
  percentage: number;
}

// Filter and pagination types
export interface SurveyFilters {
  status?: SurveyStatus;
  search?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

// Export options
export interface ExportOptions {
  format: "csv" | "json";
  include_user_data: boolean;
  anonymize: boolean;
  date_range?: {
    start: string;
    end: string;
  };
}

