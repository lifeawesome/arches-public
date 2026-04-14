// Work order types for the work request system

export interface WorkOrder {
  id: string;
  work_request_id: string;
  order_number: number;
  title: string;
  description: string;
  deliverables: string[];
  estimated_hours?: number;
  estimated_duration_days?: number;
  
  // Requirements
  required_skills: string[];
  required_expertise_area: string;
  difficulty_level: string;
  prerequisites: number[];
  
  // Budget
  budget_allocated?: number;
  
  // Assignment and matching
  status: WorkOrderStatus;
  assigned_expert_id?: string;
  matched_experts?: any[]; // Array of matched experts with scores
  ai_matching_rationale?: string;
  
  // Progress
  assigned_at?: string;
  started_at?: string;
  submitted_at?: string;
  completed_at?: string;
  
  // Deliverables
  submission_notes?: string;
  submission_files?: any[];
  review_notes?: string;
  review_rating?: number;
  
  // Vector embeddings for semantic matching
  requirements_embedding?: number[];
  embedding_model?: string;
  embedding_updated_at?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export type WorkOrderStatus = 
  | 'pending'
  | 'matching'
  | 'matched'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'cancelled';

export interface WorkRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  goals: string[];
  deadline?: string;
  budget_total?: number;
  budget_currency: string;
  
  // AI processing
  ai_breakdown?: any;
  processing_status: string;
  processing_error?: string;
  
  // Status and metadata
  status: WorkRequestStatus;
  total_work_orders: number;
  completed_work_orders: number;
  
  created_at: string;
  updated_at: string;
  completed_at?: string;
  
  // Search
  searchable_content?: string;
}

export type WorkRequestStatus = 
  | 'draft'
  | 'processing'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface WorkOrderApplication {
  id: string;
  work_order_id: string;
  expert_id: string;
  cover_letter: string;
  proposed_timeline_days: number;
  proposed_budget?: number;
  portfolio_links?: string[];
  relevant_experience: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface WorkOrderUpdate {
  id: string;
  work_order_id: string;
  user_id: string;
  update_type: 'comment' | 'status_change' | 'file_upload' | 'milestone';
  content: string;
  files?: any[];
  metadata?: any;
  created_at: string;
}
