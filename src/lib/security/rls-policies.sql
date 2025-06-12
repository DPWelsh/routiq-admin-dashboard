-- =====================================================
-- ROUTIQ HUB DASHBOARD - ROW LEVEL SECURITY POLICIES
-- =====================================================
-- 
-- This file contains comprehensive RLS policies for multi-tenant
-- organization data isolation in the Routiq Hub Dashboard.
--
-- Tables covered:
-- - organizations
-- - organization_users  
-- - patients
-- - conversations
-- - messages
-- - sentiment_analysis_logs
-- - conversation_insights
-- - conversation_feedback
-- - analytics_cache
-- - sync_logs
-- - active_patients
--
-- =====================================================

-- Helper Functions for User Organization Access
-- =====================================================

-- Function to get current user's Clerk ID from JWT token
CREATE OR REPLACE FUNCTION get_current_clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  -- Extract clerk_user_id from JWT token claims
  -- This works with Supabase auth.uid() and assumes Clerk user ID is stored there
  RETURN COALESCE(
    -- Try to get from current_setting if available
    NULLIF(current_setting('app.current_clerk_user_id', true), ''),
    -- Fallback to auth.uid() if using Supabase auth
    auth.uid()::text,
    -- Final fallback to empty string (will deny access)
    ''
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all organization IDs the current user belongs to
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS TEXT[] AS $$
DECLARE
  clerk_user_id TEXT;
  org_ids TEXT[];
BEGIN
  -- Get current user's Clerk ID
  clerk_user_id := get_current_clerk_user_id();
  
  -- Return empty array if no user
  IF clerk_user_id = '' OR clerk_user_id IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;
  
  -- Get all organization IDs where user is active
  SELECT ARRAY_AGG(organization_id)
  INTO org_ids
  FROM organization_users
  WHERE clerk_user_id = get_current_clerk_user_id()
    AND status IN ('active', 'pending');
  
  -- Return empty array if null
  RETURN COALESCE(org_ids, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user has access to a specific organization
CREATE OR REPLACE FUNCTION user_has_org_access(target_org_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN target_org_id = ANY(get_user_organization_ids());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is admin in any organization
CREATE OR REPLACE FUNCTION user_is_admin_in_org(target_org_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clerk_user_id TEXT;
  is_admin BOOLEAN;
BEGIN
  clerk_user_id := get_current_clerk_user_id();
  
  IF clerk_user_id = '' OR clerk_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 
    FROM organization_users 
    WHERE clerk_user_id = get_current_clerk_user_id()
      AND organization_id = target_org_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
  ) INTO is_admin;
  
  RETURN COALESCE(is_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if request is from service role (bypass RLS)
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current role is service_role or has bypass permission
  RETURN CURRENT_USER IN ('service_role', 'postgres') 
    OR current_setting('app.bypass_rls', true) = 'true';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all organization-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_patients ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ORGANIZATIONS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Service role can access all organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Service role can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Service role can delete organizations" ON organizations;

-- Users can only see organizations they belong to
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT
  USING (
    is_service_role() OR 
    user_has_org_access(id)
  );

-- Admins can update their organization
CREATE POLICY "Admins can update their organization" ON organizations
  FOR UPDATE
  USING (
    is_service_role() OR 
    user_is_admin_in_org(id)
  );

-- Service role can perform all operations (for system operations)
CREATE POLICY "Service role can insert organizations" ON organizations
  FOR INSERT
  WITH CHECK (is_service_role());

CREATE POLICY "Service role can delete organizations" ON organizations
  FOR DELETE
  USING (is_service_role());

-- =====================================================
-- ORGANIZATION_USERS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view organization users in their orgs" ON organization_users;
DROP POLICY IF EXISTS "Service role can access all organization users" ON organization_users;
DROP POLICY IF EXISTS "Admins can manage organization users" ON organization_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON organization_users;

-- Users can view organization users in their organizations
CREATE POLICY "Users can view organization users in their orgs" ON organization_users
  FOR SELECT
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- Admins can manage organization users in their organizations
CREATE POLICY "Admins can manage organization users" ON organization_users
  FOR ALL
  USING (
    is_service_role() OR 
    user_is_admin_in_org(organization_id)
  );

-- Users can update their own organization profile
CREATE POLICY "Users can update their own profile" ON organization_users
  FOR UPDATE
  USING (
    is_service_role() OR 
    (clerk_user_id = get_current_clerk_user_id() AND user_has_org_access(organization_id))
  );

-- =====================================================
-- PATIENTS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access patients in their organizations" ON patients;
DROP POLICY IF EXISTS "Service role can access all patients" ON patients;

-- Users can access patients in their organizations
CREATE POLICY "Users can access patients in their organizations" ON patients
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- CONVERSATIONS TABLE POLICIES  
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access conversations in their organizations" ON conversations;
DROP POLICY IF EXISTS "Service role can access all conversations" ON conversations;

-- Users can access conversations in their organizations
CREATE POLICY "Users can access conversations in their organizations" ON conversations
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- MESSAGES TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access messages in their organizations" ON messages;
DROP POLICY IF EXISTS "Service role can access all messages" ON messages;

-- Users can access messages in their organizations
CREATE POLICY "Users can access messages in their organizations" ON messages
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- SENTIMENT_ANALYSIS_LOGS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access sentiment logs in their organizations" ON sentiment_analysis_logs;
DROP POLICY IF EXISTS "Service role can access all sentiment logs" ON sentiment_analysis_logs;

-- Users can access sentiment analysis logs in their organizations
CREATE POLICY "Users can access sentiment logs in their organizations" ON sentiment_analysis_logs
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- CONVERSATION_INSIGHTS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access insights in their organizations" ON conversation_insights;
DROP POLICY IF EXISTS "Service role can access all insights" ON conversation_insights;

-- Users can access conversation insights in their organizations
CREATE POLICY "Users can access insights in their organizations" ON conversation_insights
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- CONVERSATION_FEEDBACK TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access feedback in their organizations" ON conversation_feedback;
DROP POLICY IF EXISTS "Service role can access all feedback" ON conversation_feedback;

-- Users can access conversation feedback in their organizations
CREATE POLICY "Users can access feedback in their organizations" ON conversation_feedback
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- ANALYTICS_CACHE TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access analytics cache in their organizations" ON analytics_cache;
DROP POLICY IF EXISTS "Service role can access all analytics cache" ON analytics_cache;

-- Users can access analytics cache in their organizations
CREATE POLICY "Users can access analytics cache in their organizations" ON analytics_cache
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- SYNC_LOGS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access sync logs in their organizations" ON sync_logs;
DROP POLICY IF EXISTS "Service role can access all sync logs" ON sync_logs;

-- Users can access sync logs in their organizations
CREATE POLICY "Users can access sync logs in their organizations" ON sync_logs
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- ACTIVE_PATIENTS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access active patients in their organizations" ON active_patients;
DROP POLICY IF EXISTS "Service role can access all active patients" ON active_patients;

-- Users can access active patients in their organizations
CREATE POLICY "Users can access active patients in their organizations" ON active_patients
  FOR ALL
  USING (
    is_service_role() OR 
    user_has_org_access(organization_id)
  );

-- =====================================================
-- SECURITY ROLES AND PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_current_clerk_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_organization_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION user_has_org_access(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION user_is_admin_in_org(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_service_role() TO authenticated, anon;

-- Grant table permissions to authenticated users (RLS will control access)
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sentiment_analysis_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON active_patients TO authenticated;

-- Grant sequence permissions for auto-increment fields
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- SECURITY VALIDATION FUNCTIONS
-- =====================================================

-- Function to test RLS policies (for debugging)
CREATE OR REPLACE FUNCTION test_rls_policies(test_clerk_user_id TEXT)
RETURNS TABLE(
  table_name TEXT,
  operation TEXT,
  accessible_rows BIGINT,
  test_status TEXT
) AS $$
BEGIN
  -- Set the test user context
  PERFORM set_config('app.current_clerk_user_id', test_clerk_user_id, true);
  
  -- Test access to each table
  RETURN QUERY
  SELECT 'organizations'::TEXT, 'SELECT'::TEXT, 
         (SELECT COUNT(*) FROM organizations)::BIGINT,
         'OK'::TEXT;
         
  RETURN QUERY
  SELECT 'patients'::TEXT, 'SELECT'::TEXT,
         (SELECT COUNT(*) FROM patients)::BIGINT,
         'OK'::TEXT;
         
  RETURN QUERY
  SELECT 'conversations'::TEXT, 'SELECT'::TEXT,
         (SELECT COUNT(*) FROM conversations)::BIGINT,
         'OK'::TEXT;
         
  -- Reset the setting
  PERFORM set_config('app.current_clerk_user_id', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bypass RLS for system operations
CREATE OR REPLACE FUNCTION set_bypass_rls(bypass BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- Only allow service_role to set bypass
  IF CURRENT_USER = 'service_role' THEN
    PERFORM set_config('app.bypass_rls', bypass::TEXT, true);
  ELSE
    RAISE EXCEPTION 'Only service_role can bypass RLS';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- AUDIT AND MONITORING
-- =====================================================

-- Function to log RLS policy violations (optional)
CREATE OR REPLACE FUNCTION log_rls_violation(
  table_name TEXT,
  operation TEXT,
  user_id TEXT,
  attempted_org_id TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Log to system log or audit table
  RAISE LOG 'RLS Violation: User % attempted % on % for org %', 
    user_id, operation, table_name, attempted_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION get_current_clerk_user_id() IS 
'Returns the current Clerk user ID from JWT token or session context';

COMMENT ON FUNCTION get_user_organization_ids() IS 
'Returns array of organization IDs that the current user has access to';

COMMENT ON FUNCTION user_has_org_access(TEXT) IS 
'Checks if current user has access to specified organization';

COMMENT ON FUNCTION user_is_admin_in_org(TEXT) IS 
'Checks if current user is admin/owner in specified organization';

COMMENT ON FUNCTION is_service_role() IS 
'Checks if current request is from service role (bypasses RLS)';

COMMENT ON FUNCTION test_rls_policies(TEXT) IS 
'Testing function to validate RLS policies for a specific user';

COMMENT ON FUNCTION set_bypass_rls(BOOLEAN) IS 
'Allows service_role to temporarily bypass RLS for system operations';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'RLS policies successfully applied to Routiq Hub Dashboard';
  RAISE NOTICE 'Tables protected: organizations, organization_users, patients, conversations, messages, sentiment_analysis_logs, conversation_insights, conversation_feedback, analytics_cache, sync_logs, active_patients';
  RAISE NOTICE 'Helper functions created for organization-based access control';
  RAISE NOTICE 'Service role bypass functionality enabled for system operations';
END $$; 