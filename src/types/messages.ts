// Message system types for Arches Network

export type MessageType =
  | "direct_message"
  | "project_request"
  | "system_notification";
export type MessageStatus = "sent" | "delivered" | "read" | "archived";
export type ProjectRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "completed";

export interface Conversation {
  id: string;
  title?: string;
  type: MessageType;
  participants: string[]; // Array of user IDs
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  is_archived: boolean;

  // Populated fields (not in database)
  last_message?: Message;
  unread_count?: number;
  other_participant?: ConversationParticipant;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  status: MessageStatus;
  read_by: string[]; // Array of user IDs
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Populated fields
  sender?: MessageSender;
  is_read?: boolean;
}

export interface ProjectRequest {
  id: string;
  message_id: string;
  expert_id: string;
  client_id: string;
  project_title: string;
  project_description: string;
  budget_min?: number; // in USD cents
  budget_max?: number; // in USD cents
  timeline?: string;
  required_skills: string[];
  project_type?: string;
  status: ProjectRequestStatus;
  deadline?: string;
  created_at: string;
  updated_at: string;

  // Populated fields
  expert?: ProjectParticipant;
  client?: ProjectParticipant;
  message?: Message;
}

export interface MessageNotification {
  id: string;
  user_id: string;
  message_id: string;
  notification_type: string;
  sent_at?: string;
  delivery_status: string;
  email_message_id?: string;
  created_at: string;
}

export interface UserNotificationPreferences {
  user_id: string;
  email_direct_messages: boolean;
  email_project_requests: boolean;
  email_system_notifications: boolean;
  email_frequency: "immediate" | "hourly" | "daily" | "weekly";
  push_notifications: boolean;
  created_at: string;
  updated_at: string;
}

// Helper interfaces for populated data
export interface ConversationParticipant {
  id: string;
  full_name: string;
  avatar_url?: string;
  is_expert?: boolean;
  expertise_area?: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface MessageSender {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export interface ProjectParticipant {
  id: string;
  full_name: string;
  avatar_url?: string;
  expertise_area?: string;
  company?: string;
  job_title?: string;
}

// API request/response types
export interface CreateConversationRequest {
  participant_ids: string[];
  title?: string;
  type?: MessageType;
  initial_message?: string;
}

export interface SendMessageRequest {
  conversation_id: string;
  content: string;
  message_type?: MessageType;
  metadata?: Record<string, any>;
}

export interface CreateProjectRequestRequest {
  expert_id: string;
  project_title: string;
  project_description: string;
  budget_min?: number;
  budget_max?: number;
  timeline?: string;
  required_skills?: string[];
  project_type?: string;
  deadline?: string;
  initial_message: string;
}

export interface UpdateProjectRequestRequest {
  status?: ProjectRequestStatus;
  response_message?: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  unread_total: number;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  conversation: Conversation;
}

// Dashboard summary types
export interface MessageDashboardSummary {
  total_conversations: number;
  unread_messages: number;
  pending_project_requests: number;
  recent_conversations: Conversation[];
  recent_project_requests: ProjectRequest[];
}

// Message search and filtering
export interface MessageSearchFilters {
  conversation_type?: MessageType;
  status?: MessageStatus;
  sender_id?: string;
  date_from?: string;
  date_to?: string;
  has_unread?: boolean;
}

export interface ConversationSearchFilters {
  type?: MessageType;
  participant_id?: string;
  has_unread?: boolean;
  is_archived?: boolean;
  created_after?: string;
}

