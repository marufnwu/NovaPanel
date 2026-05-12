-- NovaPanel v3 Architecture Migration - Step 1
-- Adds columns for domain/website separation and primary flag tracking

-- 1. Add isPrimary column to domains table
-- This flag marks the primary domain of a website (at most one per website)
ALTER TABLE domains ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0;

-- 2. Add suspendedConfig column to domains table
-- Stores the nginx server block content when a single domain is suspended
-- so it can be restored without file-level backups
ALTER TABLE domains ADD COLUMN suspended_config TEXT;

-- 3. Rename websites.documentRoot to websites.homeDir
-- The home directory is the website root, not just the primary docroot
-- We'll keep documentRoot for backward compat but create homeDir as the new path
ALTER TABLE websites ADD COLUMN home_dir TEXT NOT NULL DEFAULT '';

-- Backfill home_dir from document_root for existing websites
UPDATE websites SET home_dir = document_root WHERE home_dir = '';

-- 4. Create partial unique index to enforce at most one primary per website
-- SQLite doesn't support partial indexes directly, so we use a unique index with a check constraint
-- But SQLite doesn't support check constraints in CREATE INDEX, so we handle this at the application level
-- However, we can still create the index for documentation purposes
-- The real constraint is enforced in DomainsService.makePrimary()

-- Note: Due to SQLite limitations, we handle the "one primary per website" constraint
-- at the application/service layer. The index below is for documentation only.
-- CREATE UNIQUE INDEX idx_domains_one_primary_per_website ON domains (website_id) WHERE is_primary = 1;

-- 5. Add type enum value 'addon' (renamed from 'alias')
-- SQLite doesn't support altering enum values, so we handle this at the application layer
-- Existing 'alias' type will be treated as 'addon' in the service layer

-- 6. Add indexes for performance on commonly queried columns
CREATE INDEX IF NOT EXISTS idx_domains_website_id ON domains(website_id);
CREATE INDEX IF NOT EXISTS idx_domains_type ON domains(type);
CREATE INDEX IF NOT EXISTS idx_domains_parent_domain_id ON domains(parent_domain_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);