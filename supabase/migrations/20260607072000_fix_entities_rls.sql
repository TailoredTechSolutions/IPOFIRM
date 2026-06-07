-- Fix entities RLS policy: change "Enable read access for all users" (SELECT without auth)
-- to require authentication, matching the pattern used by other tables in later migrations

-- Drop the existing overly-permissive policy
DROP POLICY IF EXISTS "Enable read access for all users" ON entities;

-- Add new policy requiring authentication for SELECT
CREATE POLICY "Authenticated users can read entities"
  ON entities FOR SELECT
  USING (auth.uid() IS NOT NULL);