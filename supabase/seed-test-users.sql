-- ============================================================================
-- TEST USERS FOR LOCAL DEVELOPMENT
-- ============================================================================
-- This section contains test users for various scenarios.
-- Password for all test users: "password"
-- Encrypted password hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
-- ============================================================================

-- ADMIN USER: dan@archesnetwork.com
-- Role: admin | Password: password
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'dan@archesnetwork.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(), '{"provider": "email", "providers": ["email"]}', '{"sub": "00000000-0000-0000-0000-000000000001", "email": "dan@archesnetwork.com", "full_name": "Dan Davidson", "email_verified": true}', NULL, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);

INSERT INTO "auth"."identities" ("id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "email") VALUES
	('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '{"sub": "00000000-0000-0000-0000-000000000001", "email": "dan@archesnetwork.com", "email_verified": true}', 'email', NOW(), NOW(), NOW(), 'dan@archesnetwork.com');

INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "created_at", "updated_at", "role", "onboarding_completed", "email_verified") VALUES
	('00000000-0000-0000-0000-000000000001', 'dan@archesnetwork.com', 'Dan Davidson', NULL, NOW(), NOW(), 'admin', true, true);


-- TEST USER 1: Free Member (no subscription)
-- Email: free@test.com | Password: password
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'free@test.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(), '{"provider": "email", "providers": ["email"]}', '{"sub": "00000000-0000-0000-0000-000000000002", "email": "free@test.com", "full_name": "Free User", "email_verified": true}', NULL, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);

INSERT INTO "auth"."identities" ("id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "email") VALUES
	('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '{"sub": "00000000-0000-0000-0000-000000000002", "email": "free@test.com", "email_verified": true}', 'email', NOW(), NOW(), NOW(), 'free@test.com');

INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "created_at", "updated_at", "role", "onboarding_completed", "email_verified") VALUES
	('00000000-0000-0000-0000-000000000002', 'free@test.com', 'Free User', NULL, NOW(), NOW(), 'member', true, true);


-- TEST USER 2: Paid Member (active subscription)
-- Email: paid@test.com | Password: password
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'paid@test.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(), '{"provider": "email", "providers": ["email"]}', '{"sub": "00000000-0000-0000-0000-000000000003", "email": "paid@test.com", "full_name": "Paid User", "email_verified": true}', NULL, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);

INSERT INTO "auth"."identities" ("id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "email") VALUES
	('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '{"sub": "00000000-0000-0000-0000-000000000003", "email": "paid@test.com", "email_verified": true}', 'email', NOW(), NOW(), NOW(), 'paid@test.com');

INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "created_at", "updated_at", "role", "onboarding_completed", "email_verified", "subscription_status") VALUES
	('00000000-0000-0000-0000-000000000003', 'paid@test.com', 'Paid User', NULL, NOW(), NOW(), 'member', true, true, 'active');

-- Add active subscription for paid user
INSERT INTO "public"."subscriptions" ("id", "user_id", "status", "price_id", "quantity", "cancel_at_period_end", "created", "current_period_start", "current_period_end", "ended_at", "cancel_at", "canceled_at", "trial_start", "trial_end") VALUES
	('sub_test_paid_001', '00000000-0000-0000-0000-000000000003', 'active', 'price_test', 1, false, NOW(), NOW(), NOW() + INTERVAL '30 days', NULL, NULL, NULL, NULL, NULL);


-- TEST USER 3: Trial Member (trialing subscription)
-- Email: trial@test.com | Password: password
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'trial@test.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(), '{"provider": "email", "providers": ["email"]}', '{"sub": "00000000-0000-0000-0000-000000000004", "email": "trial@test.com", "full_name": "Trial User", "email_verified": true}', NULL, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);

INSERT INTO "auth"."identities" ("id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "email") VALUES
	('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '{"sub": "00000000-0000-0000-0000-000000000004", "email": "trial@test.com", "email_verified": true}', 'email', NOW(), NOW(), NOW(), 'trial@test.com');

INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "created_at", "updated_at", "role", "onboarding_completed", "email_verified", "subscription_status") VALUES
	('00000000-0000-0000-0000-000000000004', 'trial@test.com', 'Trial User', NULL, NOW(), NOW(), 'member', true, true, 'trialing');

-- Add trialing subscription for trial user
INSERT INTO "public"."subscriptions" ("id", "user_id", "status", "price_id", "quantity", "cancel_at_period_end", "created", "current_period_start", "current_period_end", "ended_at", "cancel_at", "canceled_at", "trial_start", "trial_end") VALUES
	('sub_test_trial_001', '00000000-0000-0000-0000-000000000004', 'trialing', 'price_test', 1, false, NOW(), NOW(), NOW() + INTERVAL '14 days', NULL, NULL, NULL, NOW(), NOW() + INTERVAL '14 days');


-- TEST USER 4: Expert User (with expert profile)
-- Email: expert@test.com | Password: password
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'expert@test.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(), '{"provider": "email", "providers": ["email"]}', '{"sub": "00000000-0000-0000-0000-000000000005", "email": "expert@test.com", "full_name": "Expert User", "user_type": "expert", "email_verified": true}', NULL, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);

INSERT INTO "auth"."identities" ("id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "email") VALUES
	('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', '{"sub": "00000000-0000-0000-0000-000000000005", "email": "expert@test.com", "email_verified": true}', 'email', NOW(), NOW(), NOW(), 'expert@test.com');

INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "created_at", "updated_at", "role", "onboarding_completed", "email_verified", "is_expert") VALUES
	('00000000-0000-0000-0000-000000000005', 'expert@test.com', 'Expert User', NULL, NOW(), NOW(), 'member', true, true, true);

INSERT INTO "public"."experts" ("id", "user_id", "is_approved", "expertise", "bio", "years_experience", "rate", "availability", "created_at", "updated_at", "last_active_at") VALUES
	('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000005', true, 'Full-Stack Development', 'Experienced developer specializing in React, Node.js, and PostgreSQL. Available for consulting and project work.', 8, 150, 'available', NOW(), NOW(), NOW());


-- ============================================================================
-- END TEST USERS
-- ============================================================================



