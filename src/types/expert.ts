// Expert profile types
export interface Expert {
  id: string;
  user_id: string;
  is_active: boolean;
  expertise_area: string;
  bio?: string;
  years_experience?: number;
  hourly_rate?: number; // in USD cents
  availability_status: "available" | "busy" | "unavailable";
  availability_description?: string;

  // Profile data (joined from profiles table)
  profiles?: {
    avatar_url?: string;
  };

  // Professional links
  linkedin_url?: string;
  portfolio_url?: string;
  website_url?: string;
  github_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  instagram_url?: string;

  // Subscription-based visibility flags (set by API)
  _subscription_required?: boolean;
  _is_masked?: boolean;

  // Resume and AI parsing
  resume_file_path?: string;
  resume_parsed_content?: ResumeParsedContent;
  resume_skills?: string[];
  resume_experience?: WorkExperience[];
  resume_education?: Education[];
  resume_certifications?: Certification[];
  searchable_content?: string;

  // AI analysis results
  ai_analysis?: AIAnalysis;
  skill_categories?: string[];
  industry_experience?: string[];
  project_types?: string[];

  // Verification and quality
  is_verified: boolean;
  verification_notes?: string;
  profile_completeness_score: number;

  // Vector embeddings for semantic matching (multi-embedding approach)
  expertise_area_embedding?: number[];
  skills_embedding?: number[];
  education_embedding?: number[];
  experience_embedding?: number[];
  embedding_model?: string;
  embedding_updated_at?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

// AI-parsed resume content structure
export interface ResumeParsedContent {
  personal_info: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
  };
  work_experience: WorkExperience[];
  education: Education[];
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
    tools: string[];
  };
  certifications: Certification[];
  projects: Project[];
  achievements: string[];
}

export interface WorkExperience {
  company: string;
  position: string;
  start_date: string;
  end_date?: string;
  current: boolean;
  description: string;
  achievements: string[];
  skills_used: string[];
  industry?: string;
  company_size?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date: string;
  end_date?: string;
  gpa?: number;
  honors?: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  issue_date: string;
  expiry_date?: string;
  credential_id?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  start_date: string;
  end_date?: string;
  url?: string;
  role?: string;
}

// AI analysis results
export interface AIAnalysis {
  expertise_summary: string;
  skill_analysis: {
    primary_skills: string[];
    secondary_skills: string[];
    emerging_skills: string[];
    skill_gaps: string[];
  };
  experience_analysis: {
    total_years: number;
    industry_experience: Array<{
      industry: string;
      years: number;
      level: "junior" | "mid" | "senior" | "lead" | "executive";
    }>;
    role_progression: string[];
    leadership_experience: boolean;
  };
  market_analysis: {
    market_demand: "high" | "medium" | "low";
    salary_range: {
      min: number;
      max: number;
      currency: string;
    };
    growth_potential: "high" | "medium" | "low";
  };
  recommendations: {
    skill_improvements: string[];
    certification_suggestions: string[];
    career_path_suggestions: string[];
  };
  confidence_score: number; // 0-100
}

// Expert search and filtering
export interface ExpertSearchFilters {
  expertise_area?: string;
  skills?: string[];
  industry_experience?: string[];
  years_experience_min?: number;
  years_experience_max?: number;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  availability_status?: string[];
  is_verified?: boolean;
  location?: string;
}

export interface ExpertSearchResult {
  expert: Expert;
  relevance_score: number;
  matched_skills: string[];
  matched_criteria: string[];
}

// Expert creation/update types
export interface CreateExpertData {
  expertise_area: string;
  bio?: string;
  years_experience?: number;
  hourly_rate?: number;
  availability_status?: string;
  availability_description?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  website_url?: string;
  github_url?: string;
}

export interface UpdateExpertData extends Partial<CreateExpertData> {
  is_active?: boolean;
  resume_file_path?: string;
  resume_parsed_content?: any;
  resume_skills?: string[];
  resume_experience?: any[];
  resume_education?: any[];
  resume_certifications?: any[];
  searchable_content?: string;
  ai_analysis?: any;
  skill_categories?: any;
  industry_experience?: string[];
  project_types?: string[];
}
