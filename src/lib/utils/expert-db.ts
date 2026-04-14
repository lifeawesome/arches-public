import { createClient } from "@/utils/supabase/client";
import {
  Expert,
  CreateExpertData,
  UpdateExpertData,
  ExpertSearchFilters,
  ExpertSearchResult,
} from "@/types/expert";
import { calculateProfileCompletenessScore } from "./calculate-profile-completeness";

export class ExpertDatabase {
  private supabase = createClient();

  /**
   * Create a new expert profile
   */
  async createExpert(userId: string, data: CreateExpertData): Promise<Expert> {
    const profileData = {
      user_id: userId,
      ...data,
    };

    const { data: expert, error } = await this.supabase
      .from("experts")
      .insert({
        ...profileData,
        profile_completeness_score:
          calculateProfileCompletenessScore(profileData),
      } as never)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create expert: ${error.message}`);
    }

    return expert;
  }

  /**
   * Get expert profile by user ID
   */
  async getExpertByUserId(userId: string): Promise<Expert | null> {
    const { data: expert, error } = await this.supabase
      .from("experts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw new Error(`Failed to get expert: ${error.message}`);
    }

    return expert;
  }

  /**
   * Update expert profile
   */
  async updateExpert(userId: string, data: UpdateExpertData): Promise<Expert> {
    // Get current expert data to merge with updates for complete score calculation
    const currentExpert = await this.getExpertByUserId(userId);

    if (!currentExpert) {
      throw new Error("Expert profile not found");
    }

    // Merge current data with updates
    const completeData = {
      ...currentExpert,
      ...data,
    };

    // Recalculate completeness score
    const completenessScore = calculateProfileCompletenessScore(completeData);

    const { data: expert, error } = await this.supabase
      .from("experts")
      .update({
        ...data,
        profile_completeness_score: completenessScore,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update expert: ${error.message}`);
    }

    return expert;
  }

  /**
   * Upload and parse resume
   */
  async uploadResume(
    userId: string,
    file: File
  ): Promise<{ filePath: string; parsedContent: any }> {
    // Upload file to storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}-resume-${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from("resumes")
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`Failed to upload resume: ${uploadError.message}`);
    }

    // Extract text from resume (you'll need to implement this based on file type)
    const resumeText = await this.extractTextFromFile(file);

    // Parse with AI
    const { AIResumeParser } = await import("@/services/ai-resume-parser");
    const parser = new AIResumeParser();
    const parsedContent = await parser.parseResume(resumeText);
    const aiAnalysis = await parser.analyzeResume(parsedContent);

    // Generate searchable content
    const searchableContent = parser.generateSearchableContent(parsedContent);
    const skillCategories = parser.categorizeSkills(
      parsedContent.skills.technical
    );

    // Update expert profile with parsed data
    await this.updateExpert(userId, {
      resume_file_path: uploadData.path as string,
      resume_parsed_content: parsedContent,
      resume_skills: parsedContent.skills.technical,
      resume_experience: parsedContent.work_experience,
      resume_education: parsedContent.education,
      resume_certifications: parsedContent.certifications,
      searchable_content: searchableContent,
      ai_analysis: aiAnalysis,
      skill_categories: skillCategories,
      industry_experience: this.extractIndustryExperience(
        parsedContent.work_experience
      ),
      project_types: this.extractProjectTypes(
        parsedContent.work_experience,
        parsedContent.projects
      ),
    });

    return {
      filePath: uploadData.path,
      parsedContent,
    };
  }

  /**
   * Search experts with filters
   */
  async searchExperts(
    query: string,
    filters: ExpertSearchFilters = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<ExpertSearchResult[]> {
    let supabaseQuery = this.supabase
      .from("experts")
      .select("*")
      .eq("is_active", true);

    // Apply filters
    if (filters.expertise_area) {
      supabaseQuery = supabaseQuery.ilike(
        "expertise_area",
        `%${filters.expertise_area}%`
      );
    }

    if (filters.skills && filters.skills.length > 0) {
      supabaseQuery = supabaseQuery.overlaps("resume_skills", filters.skills);
    }

    if (filters.industry_experience && filters.industry_experience.length > 0) {
      supabaseQuery = supabaseQuery.overlaps(
        "industry_experience",
        filters.industry_experience
      );
    }

    if (filters.years_experience_min) {
      supabaseQuery = supabaseQuery.gte(
        "years_experience",
        filters.years_experience_min
      );
    }

    if (filters.years_experience_max) {
      supabaseQuery = supabaseQuery.lte(
        "years_experience",
        filters.years_experience_max
      );
    }

    if (filters.hourly_rate_min) {
      supabaseQuery = supabaseQuery.gte(
        "hourly_rate",
        filters.hourly_rate_min * 100
      ); // Convert to cents
    }

    if (filters.hourly_rate_max) {
      supabaseQuery = supabaseQuery.lte(
        "hourly_rate",
        filters.hourly_rate_max * 100
      ); // Convert to cents
    }

    if (filters.availability_status && filters.availability_status.length > 0) {
      supabaseQuery = supabaseQuery.in(
        "availability_status",
        filters.availability_status
      );
    }

    if (filters.is_verified !== undefined) {
      supabaseQuery = supabaseQuery.eq("is_verified", filters.is_verified);
    }

    // Full-text search
    if (query) {
      supabaseQuery = supabaseQuery.textSearch("searchable_content", query);
    }

    // Order by relevance and completeness
    supabaseQuery = supabaseQuery
      .order("profile_completeness_score", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: experts, error } = await supabaseQuery;

    if (error) {
      throw new Error(`Failed to search experts: ${error.message}`);
    }

    // Calculate relevance scores (simplified)
    return experts.map((expert: any) => ({
      expert,
      relevance_score: this.calculateRelevanceScore(expert, query, filters),
      matched_skills: this.getMatchedSkills(expert as any, filters.skills || []),
      matched_criteria: this.getMatchedCriteria(expert, filters),
    }));
  }

  /**
   * Get expert recommendations for a user
   */
  async getExpertRecommendations(
    userId: string,
    limit: number = 10
  ): Promise<Expert[]> {
    // This would use AI to recommend experts based on user's project history, preferences, etc.
    // For now, return top experts by completeness score
    const { data: experts, error } = await this.supabase
      .from("experts")
      .select("*")
      .eq("is_active", true)
      .neq("user_id", userId) // Don't recommend self
      .order("profile_completeness_score", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recommendations: ${error.message}`);
    }

    return experts;
  }

  /**
   * Get expert statistics
   */
  async getExpertStats(): Promise<{
    total_experts: number;
    active_experts: number;
    verified_experts: number;
    avg_completeness_score: number;
    top_skills: Array<{ skill: string; count: number }>;
    top_industries: Array<{ industry: string; count: number }>;
  }> {
    const { data: experts, error } = await this.supabase
      .from("experts")
      .select("*");

    if (error) {
      throw new Error(`Failed to get expert stats: ${error.message}`);
    }

    const totalExperts = experts.length;
    const activeExperts = experts.filter((e: Expert) => e.is_active).length;
    const verifiedExperts = experts.filter((e: Expert) => e.is_verified).length;
    const avgCompleteness =
      experts.reduce(
        (sum: number, e: Expert) => sum + e.profile_completeness_score,
        0
      ) / totalExperts;

    // Count skills
    const skillCounts = new Map<string, number>();
    experts.forEach((expert: Expert) => {
      expert.resume_skills?.forEach((skill) => {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
      });
    });

    const topSkills = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    // Count industries
    const industryCounts = new Map<string, number>();
    experts.forEach((expert: Expert) => {
      expert.industry_experience?.forEach((industry) => {
        industryCounts.set(industry, (industryCounts.get(industry) || 0) + 1);
      });
    });

    const topIndustries = Array.from(industryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([industry, count]) => ({ industry, count }));

    return {
      total_experts: totalExperts,
      active_experts: activeExperts,
      verified_experts: verifiedExperts,
      avg_completeness_score: Math.round(avgCompleteness),
      top_skills: topSkills,
      top_industries: topIndustries,
    };
  }

  // Private helper methods
  private calculateRelevanceScore(
    expert: Expert,
    query: string,
    filters: ExpertSearchFilters
  ): number {
    let score = 0;

    // Base score from completeness
    score += expert.profile_completeness_score * 0.3;

    // Text search relevance
    if (
      query &&
      expert.searchable_content?.toLowerCase().includes(query.toLowerCase())
    ) {
      score += 30;
    }

    // Skill matches
    if (filters.skills) {
      const matchedSkills =
        expert.resume_skills?.filter((skill) =>
          filters.skills!.some((filterSkill) =>
            skill.toLowerCase().includes(filterSkill.toLowerCase())
          )
        ).length || 0;
      score += matchedSkills * 5;
    }

    // Industry matches
    if (filters.industry_experience) {
      const matchedIndustries =
        expert.industry_experience?.filter((industry) =>
          filters.industry_experience!.includes(industry)
        ).length || 0;
      score += matchedIndustries * 10;
    }

    return Math.min(score, 100);
  }

  private getMatchedSkills(expert: Expert, filterSkills: string[]): string[] {
    return (
      expert.resume_skills?.filter((skill) =>
        filterSkills.some((filterSkill) =>
          skill.toLowerCase().includes(filterSkill.toLowerCase())
        )
      ) || []
    );
  }

  private getMatchedCriteria(
    expert: Expert,
    filters: ExpertSearchFilters
  ): string[] {
    const matches: string[] = [];

    if (
      filters.expertise_area &&
      expert.expertise_area
        .toLowerCase()
        .includes(filters.expertise_area.toLowerCase())
    ) {
      matches.push("Expertise Area");
    }

    if (
      filters.skills &&
      this.getMatchedSkills(expert, filters.skills).length > 0
    ) {
      matches.push("Skills");
    }

    if (
      filters.industry_experience &&
      expert.industry_experience?.some((industry) =>
        filters.industry_experience!.includes(industry)
      )
    ) {
      matches.push("Industry Experience");
    }

    return matches;
  }

  private extractIndustryExperience(workExperience: any[]): string[] {
    const industries = new Set<string>();
    workExperience.forEach((exp) => {
      if (exp.industry) {
        industries.add(exp.industry);
      }
    });
    return Array.from(industries);
  }

  private extractProjectTypes(
    workExperience: any[],
    projects: any[]
  ): string[] {
    const types = new Set<string>();
    [...workExperience, ...projects].forEach((item) => {
      const description = (item.description || "").toLowerCase();
      if (description.includes("web")) types.add("Web Development");
      if (description.includes("mobile")) types.add("Mobile Development");
      if (description.includes("api")) types.add("API Development");
      if (description.includes("e-commerce")) types.add("E-commerce");
      if (description.includes("saas")) types.add("SaaS");
    });
    return Array.from(types);
  }

  private async extractTextFromFile(file: File): Promise<string> {
    try {
      switch (file.type) {
        case "text/plain":
          return await file.text();

        case "application/pdf":
          return await this.extractTextFromPDF(file);

        case "application/msword":
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          return await this.extractTextFromWord(file);

        default:
          throw new Error(`Unsupported file type: ${file.type}`);
      }
    } catch (error) {
      console.error("Error extracting text from file:", error);
      throw new Error(`Failed to extract text from ${file.type} file`);
    }
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    try {
      const pdfParseModule: any = await import("pdf-parse");
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error("Error parsing PDF:", error);
      throw new Error("Failed to extract text from PDF file");
    }
  }

  private async extractTextFromWord(file: File): Promise<string> {
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error("Error parsing Word document:", error);
      throw new Error("Failed to extract text from Word document");
    }
  }
}
