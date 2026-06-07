-- Fix entities table schema issues:
-- 1. registry_id UNIQUE constraint conflicts with upsert using composite key (registry_id, registry_source)
--    Solution: Drop UNIQUE on registry_id, add composite UNIQUE (registry_id, registry_source)
-- 2. status CHECK constraint doesn't include 'flagged', 'dismissed', 'exported' used by entity-action code
--    Solution: Drop old CHECK, add new CHECK with all valid statuses

-- Step 1: Drop the existing UNIQUE constraint on registry_id
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_registry_id_key;

-- Step 2: Add composite UNIQUE constraint matching the upsert onConflict target
-- First clean up any duplicate (registry_id, registry_source) pairs that may have sneaked in
DELETE FROM entities a
WHERE a.ctid <> (SELECT min(b.ctid) FROM entities b
                 WHERE b.registry_id = a.registry_id AND b.registry_source = a.registry_source);

ALTER TABLE entities ADD CONSTRAINT entities_registry_id_source_unique UNIQUE (registry_id, registry_source);

-- Step 3: Drop the old status CHECK constraint
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_status_check;

-- Step 4: Add updated status CHECK constraint including all valid values used in code
ALTER TABLE entities ADD CONSTRAINT entities_status_check
  CHECK (status IN ('Active', 'Inactive', 'Dissolved', 'Unknown', 'flagged', 'dismissed', 'exported'));

-- Add index for the composite key to support fast upsert lookups
CREATE INDEX IF NOT EXISTS idx_entities_registry_id_source ON entities(registry_id, registry_source);