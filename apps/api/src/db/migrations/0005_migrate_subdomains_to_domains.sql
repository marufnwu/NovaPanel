-- NovaPanel v3 Architecture Migration - Step 2
-- Migrate subdomains table into domains table
-- This is a one-time migration to unify subdomain storage

-- First, check if subdomains table has any data
-- If it does, we'll migrate each subdomain to a domain row

-- For each subdomain:
-- 1. Insert a new domain row with type='subdomain'
-- 2. Set parentDomainId to the parent domain's id
-- 3. Set websiteId (from subdomain's own websiteId, or inherit from parent domain)
-- 4. Compute documentRoot as: /var/www/sites/{websiteId}/subdomains/{subdomainId}/httpdocs
-- 5. Copy phpVersion if set on subdomain, otherwise inherit

-- The migration is idempotent - it only runs if subdomains table exists and has data
-- We use a script approach since drizzle migrations can't do conditional logic

-- Migration approach:
-- 1. For each subdomain, find parent domain to get websiteId
-- 2. Insert into domains with type='subdomain', parentDomainId set, isPrimary=0
-- 3. Keep the subdomain record until after verification

-- Note: This migration assumes:
-- - parent domain exists and has a websiteId
-- - subdomain has a valid name (FQDN)
-- - We create a deterministic documentRoot based on website homeDir

-- After successful migration, the subdomains table will be dropped in a later migration

-- Sample query structure (will be executed via JS migration script, not raw SQL):
-- INSERT INTO domains (id, name, type, websiteId, parentDomainId, documentRoot, phpVersion, status, createdAt)
-- SELECT 
--   s.id,
--   s.name,
--   'subdomain',
--   COALESCE(s.website_id, d.website_id),
--   s.domain_id,
--   '/var/www/sites/' || COALESCE(s.website_id, d.website_id) || '/subdomains/' || s.id || '/httpdocs',
--   COALESCE(s.php_version, d.php_version),
--   'active',
--   unixepoch()
-- FROM subdomains s
-- JOIN domains d ON d.id = s.domain_id
-- WHERE NOT EXISTS (SELECT 1 FROM domains WHERE id = s.id);

-- For now, we create the directory migration logic that will be run via JS
-- This creates the addons/ and subdomains/ directories under each website home

-- Create addons/ subdirectory for each website (if not exists)
-- CREATE TABLE IF NOT EXISTS _migration_log (
--   id INTEGER PRIMARY KEY,
--   action TEXT,
--   timestamp INTEGER DEFAULT unixepoch()
-- );