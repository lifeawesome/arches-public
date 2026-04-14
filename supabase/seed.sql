-- ============================================================================
-- Arches Network - Local Development Seed File
-- ============================================================================
-- This file is for LOCAL DEVELOPMENT only and seeds test data for various
-- user types, subscription states, circles, pathways, and moderation samples.
--
-- Kept in sync with migrations (e.g. profiles.app_access_level / app_subscription_tier,
-- circle_content.approval_status, circle_reports.reason, platform_reports).
--
-- To reset and seed: supabase db reset
--
-- Note: This is synthetic data, not a dump of production.
-- ============================================================================

SET session_replication_role = 'replica';

-- ============================================================================
-- ADMIN USER
-- ============================================================================
-- Email: dan@archesnetwork.com
-- Password: password
-- Role: admin

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    is_sso_user
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'dan@archesnetwork.com',
    '$2a$10$kfCwPFv2LJ8OE5oD0UBPRemQaplkZ6d8lDuNyDARtS.zfwhDrsN46', -- 'password'
    NOW(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Dan Admin"}',
    TRUE,
    NOW(),
    NOW(),
    FALSE
);

INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '{"sub": "00000000-0000-0000-0000-000000000001", "email": "dan@archesnetwork.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    gen_random_uuid()
);

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    app_access_level,
    app_subscription_tier,
    is_expert,
    onboarding_completed,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dan@archesnetwork.com',
    'Dan Admin',
    'admin',
    'administrator',
    'established',
    TRUE,
    TRUE,
    NOW(),
    NOW()
);

-- ============================================================================
-- TEST USER 1: FREE USER (No subscription)
-- ============================================================================
-- Email: free@test.com
-- Password: password
-- Type: Regular member, no active subscription

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    is_sso_user
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'free@test.com',
    '$2a$10$kfCwPFv2LJ8OE5oD0UBPRemQaplkZ6d8lDuNyDARtS.zfwhDrsN46',
    NOW(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Free User"}',
    FALSE,
    NOW(),
    NOW(),
    FALSE
);

INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '{"sub": "00000000-0000-0000-0000-000000000002", "email": "free@test.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    gen_random_uuid()
);

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    app_access_level,
    app_subscription_tier,
    is_expert,
    onboarding_completed,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'free@test.com',
    'Free User',
    'member',
    'user',
    'explorer',
    FALSE,
    TRUE,
    NOW(),
    NOW()
);

-- ============================================================================
-- TEST USER 2: PAID USER (Active subscription)
-- ============================================================================
-- Email: paid@test.com
-- Password: password
-- Type: Member with active paid subscription

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    is_sso_user
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'paid@test.com',
    '$2a$10$kfCwPFv2LJ8OE5oD0UBPRemQaplkZ6d8lDuNyDARtS.zfwhDrsN46',
    NOW(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Paid User"}',
    FALSE,
    NOW(),
    NOW(),
    FALSE
);

INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    '{"sub": "00000000-0000-0000-0000-000000000003", "email": "paid@test.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    gen_random_uuid()
);

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    app_access_level,
    app_subscription_tier,
    is_expert,
    onboarding_completed,
    subscription_status,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000003',
    'paid@test.com',
    'Paid User',
    'member',
    'user',
    'practitioner',
    FALSE,
    TRUE,
    'active',
    NOW(),
    NOW()
);

-- Add subscription record for paid user
INSERT INTO public.subscriptions (
    id,
    user_id,
    status,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
) VALUES (
    'sub_test_paid',
    '00000000-0000-0000-0000-000000000003',
    'active',
    NOW(),
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
);

-- ============================================================================
-- TEST USER 3: TRIAL USER (Trialing subscription)
-- ============================================================================
-- Email: trial@test.com
-- Password: password
-- Type: Member on trial period

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    is_sso_user
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'trial@test.com',
    '$2a$10$kfCwPFv2LJ8OE5oD0UBPRemQaplkZ6d8lDuNyDARtS.zfwhDrsN46',
    NOW(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Trial User"}',
    FALSE,
    NOW(),
    NOW(),
    FALSE
);

INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004',
    '{"sub": "00000000-0000-0000-0000-000000000004", "email": "trial@test.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    gen_random_uuid()
);

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    app_access_level,
    app_subscription_tier,
    is_expert,
    onboarding_completed,
    subscription_status,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000004',
    'trial@test.com',
    'Trial User',
    'member',
    'user',
    'explorer',
    FALSE,
    TRUE,
    'trialing',
    NOW(),
    NOW()
);

-- Add subscription record for trial user
INSERT INTO public.subscriptions (
    id,
    user_id,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
) VALUES (
    'sub_test_trial',
    '00000000-0000-0000-0000-000000000004',
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW()
);

-- ============================================================================
-- TEST USER 4: EXPERT USER (Active expert with profile)
-- ============================================================================
-- Email: expert@test.com
-- Password: password
-- Type: Expert member with completed profile

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    is_sso_user
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'expert@test.com',
    '$2a$10$kfCwPFv2LJ8OE5oD0UBPRemQaplkZ6d8lDuNyDARtS.zfwhDrsN46',
    NOW(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Expert User"}',
    FALSE,
    NOW(),
    NOW(),
    FALSE
);

INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000005',
    '{"sub": "00000000-0000-0000-0000-000000000005", "email": "expert@test.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    gen_random_uuid()
);

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    app_access_level,
    app_subscription_tier,
    is_expert,
    onboarding_completed,
    bio,
    expertise,
    hourly_rate,
    availability,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000005',
    'expert@test.com',
    'Expert User',
    'member',
    'user',
    'professional',
    TRUE,
    TRUE,
    'Experienced full-stack developer specializing in React and Node.js.',
    ARRAY['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    150.00,
    'available',
    NOW(),
    NOW()
);

-- Add expert profile
INSERT INTO public.experts (
    id,
    user_id,
    is_active,
    expertise_area,
    bio,
    years_experience,
    hourly_rate,
    availability_status,
    is_verified,
    is_approved,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000005',
    TRUE,
    'Full-Stack Development',
    'Experienced full-stack developer with expertise in modern web technologies. Specializing in React, Node.js, and TypeScript. Available for consulting and project work.',
    5,
    150.00,
    'available',
    TRUE,
    TRUE,
    NOW(),
    NOW()
);

-- ============================================================================
-- TEST USER 5: EXPERT WITH PAID SUBSCRIPTION
-- ============================================================================
-- Email: expert-paid@test.com
-- Password: password
-- Type: Expert member with active subscription

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    is_sso_user
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000006',
    'authenticated',
    'authenticated',
    'expert-paid@test.com',
    '$2a$10$kfCwPFv2LJ8OE5oD0UBPRemQaplkZ6d8lDuNyDARtS.zfwhDrsN46',
    NOW(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Paid Expert"}',
    FALSE,
    NOW(),
    NOW(),
    FALSE
);

INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
) VALUES (
    '00000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000006',
    '{"sub": "00000000-0000-0000-0000-000000000006", "email": "expert-paid@test.com"}',
    'email',
    NOW(),
    NOW(),
    NOW(),
    gen_random_uuid()
);

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    app_access_level,
    app_subscription_tier,
    is_expert,
    onboarding_completed,
    subscription_status,
    bio,
    expertise,
    hourly_rate,
    availability,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000006',
    'expert-paid@test.com',
    'Paid Expert',
    'member',
    'user',
    'established',
    TRUE,
    TRUE,
    'active',
    'Senior designer with 10+ years of experience in UX/UI design.',
    ARRAY['UX Design', 'UI Design', 'Figma', 'User Research'],
    200.00,
    'available',
    NOW(),
    NOW()
);

-- Add subscription record
INSERT INTO public.subscriptions (
    id,
    user_id,
    status,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
) VALUES (
    'sub_test_expert_paid',
    '00000000-0000-0000-0000-000000000006',
    'active',
    NOW(),
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
);

-- Add expert profile
INSERT INTO public.experts (
    id,
    user_id,
    is_active,
    expertise_area,
    bio,
    years_experience,
    hourly_rate,
    availability_status,
    is_verified,
    is_approved,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000006',
    TRUE,
    'UX/UI Design',
    'Senior designer specializing in user-centered design and modern design systems. Expert in Figma, user research, and creating delightful user experiences.',
    10,
    200.00,
    'available',
    TRUE,
    TRUE,
    NOW(),
    NOW()
);

RESET session_replication_role;

-- ============================================================================
-- TEST CIRCLES DATA
-- ============================================================================
-- Circles use visibility (public/private), category_id (required for public),
-- and is_featured (for directory). category_id references circle_categories
-- seeded in migration 20260226100000.

-- Free Circle (Women's Circle) — public, Career, featured
INSERT INTO "public"."circles" ("id", "expert_id", "name", "slug", "description", "access_type", "is_active", "settings", "visibility", "category_id", "is_featured") VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Women''s Circle', 'womens-circle', 'Empowerment Through Clarity & Connection. A supportive space for women to grow both personally and professionally.', 'free', TRUE, '{"allow_member_posts": true, "auto_approve_members": true, "show_member_list": true, "require_introduction": false}', 'public', (SELECT id FROM circle_categories WHERE slug = 'career' LIMIT 1), TRUE);

-- Subscription-gated Circle — public, Web
INSERT INTO "public"."circles" ("id", "expert_id", "name", "slug", "description", "access_type", "is_active", "settings", "visibility", "category_id", "is_featured") VALUES
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'Frontend Masters', 'frontend-masters', 'Advanced frontend development techniques and best practices. Requires platform subscription.', 'subscription', TRUE, '{"allow_member_posts": false, "auto_approve_members": true, "show_member_list": true, "require_introduction": false}', 'public', (SELECT id FROM circle_categories WHERE slug = 'web' LIMIT 1), FALSE);

-- Paid Circle — private (not in directory)
INSERT INTO "public"."circles" ("id", "expert_id", "name", "slug", "description", "access_type", "price_cents", "is_active", "settings", "visibility", "category_id", "is_featured") VALUES
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', 'Startup Accelerator', 'startup-accelerator', 'Exclusive community for startup founders. Get direct access to expert advice and resources.', 'paid', 2900, TRUE, '{"allow_member_posts": true, "auto_approve_members": false, "show_member_list": false, "require_introduction": true}', 'private', NULL, FALSE);

-- Additional public circles for directory (various categories, some featured)
INSERT INTO "public"."circles" ("id", "expert_id", "name", "slug", "description", "access_type", "is_active", "settings", "visibility", "category_id", "is_featured") VALUES
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'React & TypeScript', 'react-typescript', 'Learn React and TypeScript from the ground up. Modern patterns, hooks, and type-safe components.', 'free', TRUE, '{"allow_member_posts": true, "auto_approve_members": true, "show_member_list": true, "require_introduction": false}', 'public', (SELECT id FROM circle_categories WHERE slug = 'web' LIMIT 1), TRUE),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'DevOps & Kubernetes', 'devops-kubernetes', 'Container orchestration, CI/CD, and cloud-native practices. From Docker to Kubernetes in production.', 'free', TRUE, '{"allow_member_posts": true, "auto_approve_members": true, "show_member_list": true, "require_introduction": false}', 'public', (SELECT id FROM circle_categories WHERE slug = 'devops-cloud' LIMIT 1), FALSE),
('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', 'AI for Developers', 'ai-for-developers', 'Practical AI and ML for software developers. LLMs, tooling, and building with AI APIs.', 'free', TRUE, '{"allow_member_posts": true, "auto_approve_members": true, "show_member_list": true, "require_introduction": false}', 'public', (SELECT id FROM circle_categories WHERE slug = 'ai' LIMIT 1), TRUE),
('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Career Growth', 'career-growth', 'Level up your career: negotiations, promotions, and transitioning into leadership or new roles.', 'free', TRUE, '{"allow_member_posts": true, "auto_approve_members": true, "show_member_list": true, "require_introduction": false}', 'public', (SELECT id FROM circle_categories WHERE slug = 'career' LIMIT 1), FALSE),
('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000006', 'Open Source Contributors', 'open-source-contributors', 'Find projects, contribute your first PR, and maintain healthy open source communities.', 'free', TRUE, '{"allow_member_posts": true, "auto_approve_members": true, "show_member_list": true, "require_introduction": false}', 'public', (SELECT id FROM circle_categories WHERE slug = 'open-source' LIMIT 1), FALSE);

-- Circle Memberships
INSERT INTO "public"."circle_memberships" ("circle_id", "user_id", "membership_type", "status", "joined_at") VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'free', 'active', NOW()),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'free', 'active', NOW()),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'subscription', 'active', NOW());

-- Sample Content for Circles (stable ids for moderation/report seeds)
-- approval_status / is_deleted / is_welcome_post align with current circle_content schema
INSERT INTO "public"."circle_content" (
  "id",
  "circle_id",
  "author_id",
  "title",
  "content",
  "content_type",
  "is_free",
  "is_published",
  "is_pinned",
  "approval_status",
  "is_deleted",
  "is_welcome_post"
) VALUES
('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Welcome to the Women''s Circle', 'Welcome to our community! This is a space where women can share, learn, and grow together. Feel free to introduce yourself and share what brought you here.', 'announcement', TRUE, TRUE, TRUE, 'approved', FALSE, FALSE),
('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Burnout Prevention Strategies', 'Burnout is not a personal failure — it is a systemic issue. Here are some strategies to help you recognize and prevent burnout before it starts...', 'article', FALSE, TRUE, FALSE, 'approved', FALSE, FALSE),
('d0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'My Introduction', 'Hi everyone! I''m so excited to join this community. I''m a founder working on my first startup and looking forward to connecting with other women in similar journeys.', 'post', FALSE, TRUE, FALSE, 'approved', FALSE, FALSE);

-- Circle moderation queue: sample user report (structured reason + description, Issue #133)
INSERT INTO public.circle_reports (
  id,
  circle_id,
  reporter_id,
  reported_content_id,
  reported_comment_id,
  reason,
  description,
  reason_text,
  status,
  created_at
) VALUES (
  'e0000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  NULL,
  'spam'::report_reason,
  'Seed: looks like automated recruitment copy.',
  NULL,
  'pending',
  NOW()
);

-- Platform admin queue: sample circle-level report (free@test.com → Dan reviews as administrator)
INSERT INTO public.platform_reports (
  id,
  report_type,
  reported_id,
  reporter_id,
  reason,
  description,
  status,
  created_at
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'circle'::platform_report_type,
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000002',
  'inappropriate_content'::report_reason,
  'Seed: circle metadata concern for local QA only.',
  'pending',
  NOW()
);

-- Sample Events
INSERT INTO "public"."circle_events" ("circle_id", "title", "description", "start_time", "end_time", "timezone", "event_type", "location_details", "capacity", "is_free", "price_cents") VALUES
('10000000-0000-0000-0000-000000000001', 'Monthly Community Call', 'Join us for our monthly community call where we discuss challenges, celebrate wins, and support each other.', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '1 hour', 'America/Denver', 'online', '{"meeting_link": "https://zoom.us/j/example", "instructions": "Link will be sent 1 hour before the event"}', 50, TRUE, NULL),
('10000000-0000-0000-0000-000000000003', 'Founder Workshop: Fundraising 101', 'Learn the fundamentals of raising capital for your startup from experienced founders and investors.', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '2 hours', 'America/Denver', 'online', '{"meeting_link": "https://zoom.us/j/example2"}', 20, FALSE, 2500);

-- Sample Sessions
INSERT INTO "public"."circle_sessions" ("circle_id", "host_id", "title", "description", "session_type", "start_time", "duration_minutes", "max_participants", "price_cents") VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Office Hours with Dan', 'Ask me anything about building your business, burnout prevention, or navigating challenges.', 'office_hours', NOW() + INTERVAL '3 days', 30, 1, 0),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', '1:1 Strategy Session', 'Book a private strategy session to discuss your startup''s growth, challenges, and next steps.', 'coaching', NOW() + INTERVAL '5 days', 60, 1, 15000);

-- ============================================================================
-- SAMPLE PATHWAYS
-- ============================================================================
-- Note: Cover images should be uploaded to the 'pathway-images' Supabase storage bucket
-- with the following paths:
-- - pathway-images/building-personal-brand.jpg
-- - pathway-images/beating-burnout.jpg
-- - pathway-images/growing-instagram.jpg

-- Pathway 1: Building a Personal Brand
INSERT INTO pathways (id, slug, title, summary, outcomes, difficulty, estimated_days, is_active, cover_image_url) VALUES
('a0000000-0000-0000-0000-000000000001', 'building-personal-brand', 'Building a Personal Brand', 
 'Learn how to create and grow a compelling personal brand that opens doors and creates opportunities. This pathway will guide you through defining your unique value, crafting your story, and building an authentic online presence.',
 '["Define your unique value proposition", "Create a consistent brand identity", "Build an authentic online presence", "Develop a content strategy", "Grow your professional network"]'::jsonb,
 2, 21, true, 'pathway-images/building-personal-brand.jpg');

-- Level 1: Foundation
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, 'Foundation', 'Establish the core elements of your personal brand');

-- Level 1 Tasks
INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 1, 'Define Your Core Values', 'create-content', 20, 30,
 'Identify the 3-5 core values that define who you are and what you stand for',
 'Your values are the foundation of your brand. They guide your decisions and help others understand what matters to you.',
 'Think about the principles that guide your life and work. What do you believe in? What makes you unique? Write down 3-5 core values and a brief explanation of why each matters to you.',
 50, false),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 2, 'Craft Your Personal Mission Statement', 'create-content', 15, 25,
 'Write a clear, concise mission statement that captures your purpose and goals',
 'A mission statement helps you stay focused and communicate your purpose to others. It''s your north star.',
 'Create a 1-2 sentence mission statement that answers: What do you do? Who do you serve? What value do you provide?',
 50, false),
('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 3, 'Identify Your Target Audience', 'create-content', 20, 30,
 'Define who you want to reach and why they would be interested in your brand',
 'Knowing your audience helps you create content and messaging that resonates. You can''t be everything to everyone.',
 'Describe your ideal audience: demographics, interests, challenges, and goals. Why would they connect with your brand?',
 50, true);

-- Level 2: Identity
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 2, 'Identity', 'Create a consistent visual and verbal identity');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 1, 'Develop Your Brand Voice', 'create-content', 15, 25,
 'Define how you communicate - your tone, style, and personality',
 'Consistency in how you communicate builds recognition and trust. Your voice should reflect your values.',
 'Describe your brand voice in 3-5 adjectives. Are you professional or casual? Serious or playful? Write 3 example sentences in your brand voice.',
 50, false),
('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 2, 'Create Your Brand Story', 'create-content', 30, 45,
 'Write a compelling narrative that explains who you are and why you do what you do',
 'Stories connect people. Your brand story helps others understand your journey and creates emotional connection.',
 'Write a 200-300 word brand story that includes: your background, what led you here, your mission, and your vision for the future.',
 75, true),
('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 3, 'Design Your Visual Identity', 'create-content', 30, 60,
 'Choose colors, fonts, and visual elements that represent your brand',
 'Visual consistency makes your brand memorable and professional. It helps people recognize you instantly.',
 'Select 2-3 brand colors, 1-2 fonts, and describe the overall visual style you want (modern, classic, bold, minimal, etc.). Create a simple mood board or style guide.',
 75, false);

-- Level 3: Online Presence
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 3, 'Online Presence', 'Build and optimize your digital footprint');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 1, 'Optimize Your LinkedIn Profile', 'refine-content', 20, 30,
 'Update your LinkedIn profile to reflect your personal brand',
 'LinkedIn is often the first place people look to learn about you professionally. Make it count.',
 'Update your headline, summary, and experience sections to align with your brand. Use keywords relevant to your industry and goals.',
 50, false),
('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003', 2, 'Create a Personal Website or Portfolio', 'create-content', 60, 120,
 'Build a simple website that showcases your brand and work',
 'A personal website gives you full control over how you''re presented online. It''s your digital home.',
 'Create a simple one-page website or portfolio using a tool like Carrd, Notion, or WordPress. Include: your mission, story, work samples, and contact info.',
 100, true),
('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000003', 3, 'Develop Your Content Strategy', 'create-content', 30, 45,
 'Plan what content you''ll create and where you''ll share it',
 'Consistent, valuable content builds your brand over time. A strategy keeps you focused and effective.',
 'Choose 2-3 platforms to focus on. Plan 5 content ideas that align with your brand and provide value to your audience. Create a simple content calendar.',
 75, false);

-- Add task steps for key tasks
INSERT INTO task_steps (task_id, order_index, prompt, input_type, is_required) VALUES
('c0000000-0000-0000-0000-000000000001', 1, 'List your top 5 core values', 'short_text', true),
('c0000000-0000-0000-0000-000000000001', 2, 'Explain why each value is important to you', 'long_text', true),
('c0000000-0000-0000-0000-000000000002', 1, 'Write your personal mission statement (1-2 sentences)', 'long_text', true),
('c0000000-0000-0000-0000-000000000003', 1, 'Describe your target audience', 'long_text', true),
('c0000000-0000-0000-0000-000000000005', 1, 'Write your brand story (200-300 words)', 'long_text', true);

-- Pathway 2: Beating Burnout
INSERT INTO pathways (id, slug, title, summary, outcomes, difficulty, estimated_days, is_active, cover_image_url) VALUES
('a0000000-0000-0000-0000-000000000002', 'beating-burnout', 'Beating Burnout', 
 'Recover from burnout and build sustainable work habits. Learn to recognize warning signs, set healthy boundaries, and create systems that prevent burnout before it starts.',
 '["Recognize burnout warning signs", "Establish healthy boundaries", "Create sustainable work routines", "Develop stress management techniques", "Build a support system"]'::jsonb,
 3, 28, true, 'pathway-images/beating-burnout.jpg');

-- Level 1: Recognition
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 1, 'Recognition', 'Learn to identify burnout and understand its causes');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000004', 1, 'Assess Your Current State', 'review-work', 15, 25,
 'Complete a burnout assessment to understand where you are',
 'You can''t fix what you don''t recognize. Understanding your current state is the first step to recovery.',
 'Take a burnout assessment (Maslach Burnout Inventory or similar). Rate yourself on: emotional exhaustion, depersonalization, and personal accomplishment. Document your scores.',
 50, true),
('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000004', 2, 'Identify Your Burnout Triggers', 'create-content', 20, 30,
 'List the specific situations, tasks, or patterns that contribute to your burnout',
 'Knowing your triggers helps you anticipate and prevent burnout. Awareness is prevention.',
 'Reflect on the past month. What situations made you feel most drained? What patterns lead to stress? List your top 5 burnout triggers.',
 50, false),
('c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000004', 3, 'Track Your Energy Levels', 'practice-skill', 5, 10,
 'Start tracking your daily energy and mood patterns',
 'Data helps you see patterns you might miss. Understanding your energy cycles is key to sustainable work.',
 'For one week, rate your energy level (1-10) and mood at 3 times each day: morning, afternoon, evening. Note what activities preceded high or low energy.',
 50, false);

-- Level 2: Recovery
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 2, 'Recovery', 'Take immediate steps to recover and restore balance');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000005', 1, 'Establish Non-Negotiable Boundaries', 'create-content', 20, 30,
 'Set clear boundaries around your time, energy, and availability',
 'Boundaries protect you from overcommitment and help others respect your limits. They''re essential for recovery.',
 'List 3-5 non-negotiable boundaries (e.g., no work after 6pm, no meetings on Fridays, one day off per week). Write them down and share with relevant people.',
 75, true),
('c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000005', 2, 'Create a Recovery Routine', 'create-content', 30, 45,
 'Design daily and weekly routines that support recovery',
 'Routines create structure and ensure you prioritize recovery activities. Consistency is healing.',
 'Design a morning routine (15-30 min) and evening routine (30-60 min) that includes rest, movement, and activities you enjoy. Plan one recovery day per week.',
 75, false),
('c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000005', 3, 'Practice Stress Management Techniques', 'practice-skill', 15, 30,
 'Learn and practice 2-3 stress management techniques',
 'Having tools to manage stress in the moment prevents burnout from escalating. Practice makes them effective.',
 'Learn and practice: deep breathing, progressive muscle relaxation, or meditation. Practice one technique daily for a week. Document what works best for you.',
 50, false);

-- Level 3: Prevention
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 3, 'Prevention', 'Build systems and habits that prevent future burnout');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000006', 1, 'Design Your Ideal Work Week', 'create-content', 30, 45,
 'Create a sustainable weekly schedule that balances work and rest',
 'Prevention is better than cure. A sustainable schedule prevents burnout before it starts.',
 'Design your ideal work week: work hours, break times, focus blocks, meeting limits. Include buffer time and rest. Create a template you can follow.',
 75, false),
('c0000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000006', 2, 'Build Your Support System', 'connect-with', 20, 30,
 'Identify and connect with people who can support you',
 'You don''t have to do this alone. A support system provides accountability, perspective, and help when needed.',
 'List 3-5 people you can turn to for support (colleagues, friends, mentors, therapist). Reach out to at least one person this week. Consider joining a support group or community.',
 50, false),
('c0000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000006', 3, 'Create Your Burnout Prevention Plan', 'create-content', 30, 45,
 'Develop a comprehensive plan to prevent future burnout',
 'A prevention plan helps you stay ahead of burnout. Review it regularly and adjust as needed.',
 'Create a document that includes: your warning signs, triggers, boundaries, routines, support system, and what to do if you feel burnout returning. Review monthly.',
 100, true);

-- Add task steps
INSERT INTO task_steps (task_id, order_index, prompt, input_type, is_required) VALUES
('c0000000-0000-0000-0000-000000000010', 1, 'Rate your emotional exhaustion (1-10)', 'short_text', true),
('c0000000-0000-0000-0000-000000000010', 2, 'Rate your sense of personal accomplishment (1-10)', 'short_text', true),
('c0000000-0000-0000-0000-000000000011', 1, 'List your top 5 burnout triggers', 'short_text', true),
('c0000000-0000-0000-0000-000000000013', 1, 'List your 3-5 non-negotiable boundaries', 'short_text', true),
('c0000000-0000-0000-0000-000000000014', 1, 'Describe your morning recovery routine', 'long_text', true),
('c0000000-0000-0000-0000-000000000014', 2, 'Describe your evening recovery routine', 'long_text', true),
('c0000000-0000-0000-0000-000000000018', 1, 'Create your burnout prevention plan', 'long_text', true);

-- Pathway 3: Growing on Instagram
INSERT INTO pathways (id, slug, title, summary, outcomes, difficulty, estimated_days, is_active, cover_image_url) VALUES
('a0000000-0000-0000-0000-000000000003', 'growing-instagram', 'Growing on Instagram', 
 'Build an engaged Instagram following and grow your presence authentically. Learn content strategy, engagement tactics, and growth techniques that actually work.',
 '["Develop a content strategy", "Create engaging content", "Build authentic engagement", "Understand Instagram algorithms", "Grow your following organically"]'::jsonb,
 2, 30, true, 'pathway-images/growing-instagram.jpg');

-- Level 1: Foundation
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 1, 'Foundation', 'Set up your profile and understand your audience');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000007', 1, 'Optimize Your Instagram Profile', 'refine-content', 15, 25,
 'Create a compelling profile that clearly communicates who you are',
 'Your profile is often the first impression. Make it count. A great profile converts visitors to followers.',
 'Update your bio, profile picture, and link. Use keywords relevant to your niche. Make it clear what value you provide. Add a call-to-action.',
 50, true),
('c0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000007', 2, 'Research Your Target Audience', 'review-work', 20, 30,
 'Understand who you want to reach and what content they engage with',
 'Knowing your audience helps you create content that resonates. You can''t grow without engagement.',
 'Identify 5-10 accounts your ideal followers engage with. Analyze their content: what works? What doesn''t? Note common themes, formats, and posting times.',
 50, false),
('c0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000007', 3, 'Define Your Content Pillars', 'create-content', 20, 30,
 'Choose 3-5 main topics you''ll consistently create content about',
 'Content pillars keep you focused and help your audience know what to expect. Consistency builds trust.',
 'Choose 3-5 content pillars that align with your brand and audience interests. These are your main topics. Plan to create content across all pillars regularly.',
 50, false);

-- Level 2: Content Strategy
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 2, 'Content Strategy', 'Plan and create content that engages and grows your audience');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000008', 1, 'Create a Content Calendar', 'create-content', 30, 45,
 'Plan your content for the next month',
 'Planning ahead ensures consistency and quality. A calendar helps you balance content types and topics.',
 'Create a 30-day content calendar. Plan posts for each content pillar. Mix formats: photos, carousels, reels, stories. Schedule posting times.',
 75, true),
('c0000000-0000-0000-0000-000000000027', 'b0000000-0000-0000-0000-000000000008', 2, 'Write Engaging Captions', 'create-content', 15, 25,
 'Learn to write captions that drive engagement',
 'Great captions turn scrollers into engagers. They''re where you build connection and community.',
 'Write 5 captions using proven formulas: hook + story + value + CTA. Practice different styles: educational, personal, inspirational. Include relevant hashtags.',
 50, false),
('c0000000-0000-0000-0000-000000000023', 'b0000000-0000-0000-0000-000000000008', 3, 'Create Your First Batch of Content', 'create-content', 60, 120,
 'Produce 5-10 pieces of content ready to post',
 'Having content ready ensures consistency. Batch creation is more efficient than creating one post at a time.',
 'Create 5-10 pieces of content (photos, graphics, or reels) aligned with your content pillars. Edit them and write captions. Store them in a content library.',
 100, true);

-- Level 3: Growth & Engagement
INSERT INTO levels (id, pathway_id, order_index, title, summary) VALUES
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 3, 'Growth & Engagement', 'Build engagement and grow your following authentically');

INSERT INTO tasks (id, level_id, order_index, title, task_type, time_min, time_max, objective, why_it_matters, instructions, xp_value, is_keystone) VALUES
('c0000000-0000-0000-0000-000000000024', 'b0000000-0000-0000-0000-000000000009', 1, 'Develop an Engagement Strategy', 'create-content', 20, 30,
 'Create a plan for engaging with your audience and community',
 'Engagement is a two-way street. The more you engage, the more others engage with you. It''s the foundation of growth.',
 'Plan daily engagement: 15 min responding to comments, 15 min engaging with others'' content in your niche. Set specific times. Track your engagement rate.',
 50, false),
('c0000000-0000-0000-0000-000000000025', 'b0000000-0000-0000-0000-000000000009', 2, 'Master Instagram Stories', 'practice-skill', 15, 25,
 'Use Stories to build connection and drive traffic',
 'Stories have high engagement and help you stay top-of-mind. They''re perfect for behind-the-scenes and real-time connection.',
 'Post Stories daily for one week. Mix: behind-the-scenes, polls, Q&A, tips, day-in-the-life. Use stickers and interactive features. Track which types perform best.',
 50, false),
('c0000000-0000-0000-0000-000000000026', 'b0000000-0000-0000-0000-000000000009', 3, 'Implement Growth Tactics', 'practice-skill', 30, 45,
 'Use proven tactics to grow your following organically',
 'Growth requires strategy. These tactics, done consistently, will help you reach new audiences and convert them to followers.',
 'Implement: collaborate with 2-3 accounts in your niche, use relevant hashtags strategically, engage in trending conversations, cross-promote on other platforms. Track what works.',
 75, true);

-- Add task steps
INSERT INTO task_steps (task_id, order_index, prompt, input_type, is_required) VALUES
('c0000000-0000-0000-0000-000000000019', 1, 'Write your optimized Instagram bio', 'long_text', true),
('c0000000-0000-0000-0000-000000000020', 1, 'List 5-10 accounts your ideal followers engage with', 'short_text', true),
('c0000000-0000-0000-0000-000000000021', 1, 'List your 3-5 content pillars', 'short_text', true),
('c0000000-0000-0000-0000-000000000022', 1, 'Create your 30-day content calendar', 'long_text', true),
('c0000000-0000-0000-0000-000000000024', 1, 'Describe your daily engagement strategy', 'long_text', true);

-- ============================================================================
-- SEED COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  ✅ Local Development Seed Complete                           ║
║                                                                ║
║  Test Users Created:                                           ║
║  - dan@archesnetwork.com (admin, password)                     ║
║  - free@test.com (no subscription, password)                   ║
║  - paid@test.com (active subscription, password)               ║
║  - trial@test.com (trial subscription, password)               ║
║  - expert@test.com (expert profile, password)                  ║
║  - expert-paid@test.com (expert + subscription, password)      ║
║                                                                ║
║  Test Circles Created:                                         ║
║  - Women''s Circle (free, /circles/womens-circle)              ║
║  - Frontend Masters (subscription, /circles/frontend-masters)  ║
║  - Startup Accelerator (paid $29/mo, /circles/startup-...)    ║
║                                                                ║
║  Moderation samples (Issue #133):                            ║
║  - 1 pending circle_report on Women''s Circle (free user)    ║
║  - 1 pending platform_report on React & TypeScript circle      ║
║                                                                ║
║  Sample Pathways Created:                                      ║
║  - Building a Personal Brand (3 levels, 9 tasks)              ║
║  - Beating Burnout (3 levels, 9 tasks)                        ║
║  - Growing on Instagram (3 levels, 9 tasks)                    ║
║                                                                ║
║  📸 Cover Images: Upload to pathway-images bucket:             ║
║     - building-personal-brand.jpg                              ║
║     - beating-burnout.jpg                                      ║
║     - growing-instagram.jpg                                    ║
║                                                                ║
║  To reset: supabase db reset                                   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  ';
END $$;
