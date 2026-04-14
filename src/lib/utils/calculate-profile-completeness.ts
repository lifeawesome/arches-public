/**
 * Calculate Expert Profile Completeness Score
 *
 * Returns a score from 0-100 based on how complete an expert profile is.
 * This helps admins prioritize profiles for review and helps experts understand
 * what information is still needed.
 */

interface ProfileData {
  // Basic info (30 points total)
  expertise_area?: string | null;
  bio?: string | null;
  years_experience?: number | null;

  // Rates & availability (10 points)
  hourly_rate?: number | null;
  availability_status?: string | null;

  // Professional links (15 points)
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  website_url?: string | null;
  github_url?: string | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;

  // Resume data (30 points)
  resume_file_path?: string | null;
  resume_skills?: string[] | null;
  resume_experience?: any[] | null;
  resume_education?: any[] | null;

  // AI analysis (15 points)
  ai_analysis?: any | null;
  searchable_content?: string | null;
  skill_categories?: string[] | null;
  industry_experience?: string[] | null;
}

export function calculateProfileCompletenessScore(data: ProfileData): number {
  let score = 0;

  // Basic Information (30 points)
  if (data.expertise_area && data.expertise_area.trim().length > 0) {
    score += 10; // Essential field
  }
  if (data.bio && data.bio.trim().length > 50) {
    score += 10; // Good bio (at least 50 chars)
  }
  if (data.years_experience && data.years_experience > 0) {
    score += 10;
  }

  // Rates & Availability (10 points)
  if (data.hourly_rate && data.hourly_rate > 0) {
    score += 5;
  }
  if (data.availability_status && data.availability_status !== "unavailable") {
    score += 5;
  }

  // Professional Links (15 points - up to 3 points each)
  let linkCount = 0;
  if (data.linkedin_url && data.linkedin_url.trim().length > 0) linkCount++;
  if (data.portfolio_url && data.portfolio_url.trim().length > 0) linkCount++;
  if (data.website_url && data.website_url.trim().length > 0) linkCount++;
  if (data.github_url && data.github_url.trim().length > 0) linkCount++;
  if (data.twitter_url && data.twitter_url.trim().length > 0) linkCount++;
  if (data.facebook_url && data.facebook_url.trim().length > 0) linkCount++;
  if (data.instagram_url && data.instagram_url.trim().length > 0) linkCount++;
  score += Math.min(linkCount * 3, 15); // Max 15 points for links (up to 5 links worth 3 pts each)

  // Resume & Parsed Data (30 points)
  if (data.resume_file_path) {
    score += 5; // Has uploaded resume
  }
  if (data.resume_skills && data.resume_skills.length >= 3) {
    score += 8; // Has skills (at least 3)
  }
  if (data.resume_experience && data.resume_experience.length >= 1) {
    score += 8; // Has work experience (at least 1)
  }
  if (data.resume_education && data.resume_education.length >= 1) {
    score += 5; // Has education (at least 1)
  }
  if (data.searchable_content && data.searchable_content.length > 100) {
    score += 4; // Has substantial searchable content
  }

  // AI Analysis & Enrichment (15 points)
  if (data.ai_analysis && Object.keys(data.ai_analysis).length > 0) {
    score += 5; // Has AI analysis
  }
  if (data.skill_categories && data.skill_categories.length > 0) {
    score += 5; // Skills are categorized
  }
  if (data.industry_experience && data.industry_experience.length > 0) {
    score += 5; // Industry experience identified
  }

  // Ensure score is between 0 and 100
  return Math.min(Math.max(Math.round(score), 0), 100);
}

/**
 * Get recommendations for improving profile completeness
 */
export function getProfileCompletionRecommendations(
  data: ProfileData,
  currentScore: number
): string[] {
  const recommendations: string[] = [];

  if (!data.expertise_area || data.expertise_area.trim().length === 0) {
    recommendations.push("Add your area of expertise");
  }

  if (!data.bio || data.bio.trim().length < 50) {
    recommendations.push("Write a detailed bio (at least 50 characters)");
  }

  if (!data.years_experience || data.years_experience === 0) {
    recommendations.push("Add your years of experience");
  }

  if (!data.hourly_rate || data.hourly_rate === 0) {
    recommendations.push("Set your hourly rate");
  }

  if (!data.resume_file_path) {
    recommendations.push("Upload your resume for AI-powered profile creation");
  }

  const hasLinks = !!(
    data.linkedin_url ||
    data.portfolio_url ||
    data.website_url ||
    data.github_url ||
    data.twitter_url ||
    data.facebook_url ||
    data.instagram_url
  );
  if (!hasLinks) {
    recommendations.push(
      "Add professional and social links (LinkedIn, Portfolio, Website, GitHub, Twitter, Facebook, Instagram)"
    );
  }

  if (!data.resume_experience || data.resume_experience.length === 0) {
    recommendations.push("Add work experience to your profile");
  }

  if (!data.resume_education || data.resume_education.length === 0) {
    recommendations.push("Add your education background");
  }

  if (!data.resume_skills || data.resume_skills.length < 3) {
    recommendations.push("Add more skills (at least 3 recommended)");
  }

  return recommendations;
}
