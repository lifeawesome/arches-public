-- ============================================================================
-- Arches Network - Production Seed File
-- ============================================================================
-- This file is intentionally empty to prevent accidental seeding in production.
-- 
-- If you need to seed production data:
-- 1. Create a separate, carefully reviewed migration
-- 2. Use proper data import procedures
-- 3. Never truncate production data
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  ℹ️  Production Seed File (Empty)                             ║
║                                                                ║
║  This file intentionally contains no seed data.                ║
║  Production data should be handled through:                    ║
║  - Proper migrations                                           ║
║  - Data import procedures                                      ║
║  - Admin tools with proper safeguards                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  ';
END $$;

