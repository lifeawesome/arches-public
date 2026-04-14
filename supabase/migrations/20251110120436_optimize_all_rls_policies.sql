-- Optimize RLS policies on all tables by wrapping auth function calls in subqueries
-- This prevents re-evaluation of auth.uid() and auth.role() for each row, improving query performance
-- This migration consolidates all RLS optimizations into a single file

-- ============================================================================
-- profiles table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Subscribers can view other users' public profiles" ON profiles;
CREATE POLICY "Subscribers can view other users' public profiles" ON profiles
  FOR SELECT USING (
    (select auth.uid()) = id
    OR
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.user_id = (select auth.uid())
      AND subscriptions.status IN ('active', 'trialing')
    )
  );

DROP POLICY IF EXISTS "Users can view other users' public profiles" ON profiles;
CREATE POLICY "Users can view other users' public profiles" ON profiles
  FOR SELECT USING (
    (select auth.role()) = 'authenticated'
  );

COMMENT ON POLICY "Users can view their own profile" ON profiles IS 
  'Optimized RLS policy: Users can view their own profile. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can update their own profile" ON profiles IS 
  'Optimized RLS policy: Users can update their own profile. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can insert their own profile" ON profiles IS 
  'Optimized RLS policy: Users can insert their own profile. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Subscribers can view other users' public profiles" ON profiles IS 
  'Optimized RLS policy: Allows users with active subscriptions to view other members profiles. Uses subqueries to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can view other users' public profiles" ON profiles IS 
  'Optimized RLS policy: Allows authenticated users to view other users profiles. Uses subquery to prevent auth.role() re-evaluation per row.';

-- ============================================================================
-- course_progress table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own course progress" ON course_progress;
CREATE POLICY "Users can view their own course progress" ON course_progress
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own course progress" ON course_progress;
CREATE POLICY "Users can insert their own course progress" ON course_progress
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own course progress" ON course_progress;
CREATE POLICY "Users can update their own course progress" ON course_progress
  FOR UPDATE USING ((select auth.uid()) = user_id);

COMMENT ON POLICY "Users can view their own course progress" ON course_progress IS 
  'Optimized RLS policy: Users can view their own course progress. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can insert their own course progress" ON course_progress IS 
  'Optimized RLS policy: Users can insert their own course progress. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can update their own course progress" ON course_progress IS 
  'Optimized RLS policy: Users can update their own course progress. Uses subquery to prevent auth.uid() re-evaluation per row.';

-- ============================================================================
-- course_enrollments table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own course enrollments" ON course_enrollments;
CREATE POLICY "Users can view their own course enrollments" ON course_enrollments
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own course enrollments" ON course_enrollments;
CREATE POLICY "Users can insert their own course enrollments" ON course_enrollments
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own course enrollments" ON course_enrollments;
CREATE POLICY "Users can update their own course enrollments" ON course_enrollments
  FOR UPDATE USING ((select auth.uid()) = user_id);

COMMENT ON POLICY "Users can view their own course enrollments" ON course_enrollments IS 
  'Optimized RLS policy: Users can view their own course enrollments. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can insert their own course enrollments" ON course_enrollments IS 
  'Optimized RLS policy: Users can insert their own course enrollments. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can update their own course enrollments" ON course_enrollments IS 
  'Optimized RLS policy: Users can update their own course enrollments. Uses subquery to prevent auth.uid() re-evaluation per row.';

-- ============================================================================
-- experts table
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage own expert profile" ON experts;
CREATE POLICY "Users can manage own expert profile" ON experts
  FOR ALL USING ((select auth.uid()) = user_id);

COMMENT ON POLICY "Users can manage own expert profile" ON experts IS 
  'Optimized RLS policy: Users can manage (SELECT, INSERT, UPDATE, DELETE) their own expert profile. Uses subquery to prevent auth.uid() re-evaluation per row.';

-- ============================================================================
-- subscriptions table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON subscriptions
  FOR UPDATE USING ((select auth.uid()) = user_id);

COMMENT ON POLICY "Users can view their own subscriptions" ON subscriptions IS 
  'Optimized RLS policy: Users can view their own subscriptions. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can update their own subscriptions" ON subscriptions IS 
  'Optimized RLS policy: Users can update their own subscriptions. Uses subquery to prevent auth.uid() re-evaluation per row.';

-- ============================================================================
-- conversations table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
CREATE POLICY "Users can view conversations they participate in" ON conversations
  FOR SELECT USING ((select auth.uid()) = ANY(participants));

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
CREATE POLICY "Participants can update conversations" ON conversations
  FOR UPDATE USING ((select auth.uid()) = ANY(participants));

DROP POLICY IF EXISTS "Participants can delete conversations" ON conversations;
CREATE POLICY "Participants can delete conversations" ON conversations
  FOR DELETE USING ((select auth.uid()) = ANY(participants));

COMMENT ON POLICY "Users can view conversations they participate in" ON conversations IS 
  'Optimized RLS policy: Users can view conversations they participate in. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can create conversations" ON conversations IS 
  'Optimized RLS policy: Users can create conversations. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Participants can update conversations" ON conversations IS 
  'Optimized RLS policy: Participants can update conversations. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Participants can delete conversations" ON conversations IS 
  'Optimized RLS policy: Participants can delete conversations. Uses subquery to prevent auth.uid() re-evaluation per row.';

-- ============================================================================
-- messages table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND (select auth.uid()) = ANY(conversations.participants)
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;
CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    (select auth.uid()) = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND (select auth.uid()) = ANY(conversations.participants)
    )
  );

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING ((select auth.uid()) = sender_id);

DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON messages;
CREATE POLICY "Users can delete messages in their conversations" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND (select auth.uid()) = ANY(conversations.participants)
    )
  );

COMMENT ON POLICY "Users can view messages in their conversations" ON messages IS 
  'Optimized RLS policy: Users can view messages in their conversations. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can send messages to their conversations" ON messages IS 
  'Optimized RLS policy: Users can send messages to their conversations. Uses subqueries to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can update their own messages" ON messages IS 
  'Optimized RLS policy: Users can update their own messages. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can delete messages in their conversations" ON messages IS 
  'Optimized RLS policy: Users can delete messages in their conversations. Uses subquery to prevent auth.uid() re-evaluation per row.';

-- ============================================================================
-- project_requests table
-- ============================================================================
DROP POLICY IF EXISTS "Experts and clients can view their project requests" ON project_requests;
CREATE POLICY "Experts and clients can view their project requests" ON project_requests
  FOR SELECT USING ((select auth.uid()) = expert_id OR (select auth.uid()) = client_id);

DROP POLICY IF EXISTS "Clients can create project requests" ON project_requests;
CREATE POLICY "Clients can create project requests" ON project_requests
  FOR INSERT WITH CHECK ((select auth.uid()) = client_id);

DROP POLICY IF EXISTS "Experts and clients can update project requests" ON project_requests;
CREATE POLICY "Experts and clients can update project requests" ON project_requests
  FOR UPDATE USING ((select auth.uid()) = expert_id OR (select auth.uid()) = client_id);

COMMENT ON POLICY "Experts and clients can view their project requests" ON project_requests IS 
  'Optimized RLS policy: Experts and clients can view their project requests. Uses subqueries to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Clients can create project requests" ON project_requests IS 
  'Optimized RLS policy: Clients can create project requests. Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Experts and clients can update project requests" ON project_requests IS 
  'Optimized RLS policy: Experts and clients can update project requests. Uses subqueries to prevent auth.uid() re-evaluation per row.';

-- ============================================================================
-- message_notifications table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON message_notifications;
CREATE POLICY "Users can view their own notifications" ON message_notifications
  FOR SELECT USING ((select auth.uid()) = user_id);

-- ============================================================================
-- user_notification_preferences table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON user_notification_preferences;
CREATE POLICY "Users can view their own notification preferences" ON user_notification_preferences
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON user_notification_preferences;
CREATE POLICY "Users can update their own notification preferences" ON user_notification_preferences
  FOR ALL USING ((select auth.uid()) = user_id);

-- ============================================================================
-- work_requests table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own work requests" ON work_requests;
CREATE POLICY "Users can view own work requests" ON work_requests
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create work requests" ON work_requests;
CREATE POLICY "Users can create work requests" ON work_requests
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own work requests" ON work_requests;
CREATE POLICY "Users can update own work requests" ON work_requests
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own draft work requests" ON work_requests;
CREATE POLICY "Users can delete own draft work requests" ON work_requests
  FOR DELETE USING ((select auth.uid()) = user_id AND status = 'draft');

-- ============================================================================
-- work_orders table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own work orders" ON work_orders;
CREATE POLICY "Users can view own work orders" ON work_orders
  FOR SELECT USING (
    work_request_id IN (
      SELECT id FROM work_requests 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Experts can view assigned work orders" ON work_orders;
CREATE POLICY "Experts can view assigned work orders" ON work_orders
  FOR SELECT USING (
    assigned_expert_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM work_order_applications
      WHERE work_order_applications.work_order_id = work_orders.id
      AND work_order_applications.expert_id = (select auth.uid())
    )
  );

-- ============================================================================
-- work_order_applications table
-- ============================================================================
DROP POLICY IF EXISTS "Experts can create applications" ON work_order_applications;
CREATE POLICY "Experts can create applications" ON work_order_applications
  FOR INSERT WITH CHECK ((select auth.uid()) = expert_id);

DROP POLICY IF EXISTS "Users can view applications for their work orders" ON work_order_applications;
CREATE POLICY "Users can view applications for their work orders" ON work_order_applications
  FOR SELECT USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      WHERE wo.work_request_id IN (
        SELECT id FROM work_requests 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Experts can view their own applications" ON work_order_applications;
CREATE POLICY "Experts can view their own applications" ON work_order_applications
  FOR SELECT USING (expert_id = (select auth.uid()));

-- ============================================================================
-- work_order_updates table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view updates for their work" ON work_order_updates;
CREATE POLICY "Users can view updates for their work" ON work_order_updates
  FOR SELECT USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM work_orders
      JOIN work_requests ON work_requests.id = work_orders.work_request_id
      WHERE work_orders.id = work_order_updates.work_order_id
      AND (work_requests.user_id = (select auth.uid()) OR work_orders.assigned_expert_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can create updates" ON work_order_updates;
CREATE POLICY "Users can create updates" ON work_order_updates
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- work_order_payments table
-- ============================================================================
DROP POLICY IF EXISTS "Clients can view own payments" ON work_order_payments;
CREATE POLICY "Clients can view own payments" ON work_order_payments
  FOR SELECT USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Experts can view their payments" ON work_order_payments;
CREATE POLICY "Experts can view their payments" ON work_order_payments
  FOR SELECT USING (expert_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can create payments" ON work_order_payments;
CREATE POLICY "Clients can create payments" ON work_order_payments
  FOR INSERT WITH CHECK (client_id = (select auth.uid()));

-- ============================================================================
-- escrow_transactions table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own transactions" ON escrow_transactions;
CREATE POLICY "Users can view own transactions" ON escrow_transactions
  FOR SELECT USING (
    from_user_id = (select auth.uid()) OR 
    to_user_id = (select auth.uid()) OR
    payment_id IN (
      SELECT id FROM work_order_payments 
      WHERE client_id = (select auth.uid()) OR expert_id = (select auth.uid())
    )
  );

-- ============================================================================
-- payment_milestones table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view payment milestones" ON payment_milestones;
CREATE POLICY "Users can view payment milestones" ON payment_milestones
  FOR SELECT USING (
    payment_id IN (
      SELECT id FROM work_order_payments 
      WHERE client_id = (select auth.uid()) OR expert_id = (select auth.uid())
    )
  );

-- ============================================================================
-- saved_experts table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own saved experts" ON saved_experts;
CREATE POLICY "Users can view their own saved experts" ON saved_experts
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can save experts" ON saved_experts;
CREATE POLICY "Users can save experts" ON saved_experts
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can unsave their own saved experts" ON saved_experts;
CREATE POLICY "Users can unsave their own saved experts" ON saved_experts
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- marketing_preferences table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own marketing preferences" ON marketing_preferences;
CREATE POLICY "Users can view their own marketing preferences" ON marketing_preferences
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own marketing preferences" ON marketing_preferences;
CREATE POLICY "Users can update their own marketing preferences" ON marketing_preferences
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own marketing preferences" ON marketing_preferences;
CREATE POLICY "Users can insert their own marketing preferences" ON marketing_preferences
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- expert_offers table
-- ============================================================================
DROP POLICY IF EXISTS "Experts can view own offers" ON expert_offers;
CREATE POLICY "Experts can view own offers" ON expert_offers
  FOR SELECT USING (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Experts can insert own offers" ON expert_offers;
CREATE POLICY "Experts can insert own offers" ON expert_offers
  FOR INSERT WITH CHECK (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Experts can update own offers" ON expert_offers;
CREATE POLICY "Experts can update own offers" ON expert_offers
  FOR UPDATE USING (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Experts can delete own offers" ON expert_offers;
CREATE POLICY "Experts can delete own offers" ON expert_offers
  FOR DELETE USING (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- user_ai_preferences table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own preferences" ON user_ai_preferences;
CREATE POLICY "Users can view own preferences" ON user_ai_preferences
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own preferences" ON user_ai_preferences;
CREATE POLICY "Users can create own preferences" ON user_ai_preferences
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_ai_preferences;
CREATE POLICY "Users can update own preferences" ON user_ai_preferences
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- Add general comments for documentation
COMMENT ON POLICY "Users can view their own notifications" ON message_notifications IS 
  'Optimized RLS policy: Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can view their own notification preferences" ON user_notification_preferences IS 
  'Optimized RLS policy: Uses subquery to prevent auth.uid() re-evaluation per row.';
COMMENT ON POLICY "Users can update their own notification preferences" ON user_notification_preferences IS 
  'Optimized RLS policy: Uses subquery to prevent auth.uid() re-evaluation per row.';

