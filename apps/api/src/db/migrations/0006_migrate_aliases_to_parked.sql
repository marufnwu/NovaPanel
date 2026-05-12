-- NovaPanel v3 Architecture Migration - Step 3
-- Migrate domainAliases table into domains table as parked domains
-- This is a one-time migration to unify alias/parked storage

-- domainAliases rows become domains rows with:
-- - type = 'parked'
-- - name = alias (the parked domain name)
-- - parentDomainId = domainId (the domain being parked/aliased)
-- - websiteId = parent's websiteId (parked domains share the website)
-- - documentRoot = NULL (parked domains share primary's docroot)
-- - isPrimary = 0

-- The migration is idempotent - it only runs if domainAliases table has data

-- For each domain alias:
-- 1. Insert a new domain row with type='parked'
-- 2. Set parentDomainId to the aliased (primary) domain's id
-- 3. Set websiteId from the aliased domain's websiteId
-- 4. Leave documentRoot NULL (parked shares primary's docroot)

-- Note: Parked domains inherit the primary domain's SSL cert automatically
-- When regenerating website config, parked domains are merged into
-- the primary's server_name line

-- After successful migration, the domainAliases table will be dropped
-- in a later migration step

-- SQL approach (executed via JS migration script):
-- INSERT INTO domains (id, name, type, websiteId, parentDomainId, documentRoot, isPrimary, status, createdAt)
-- SELECT 
--   a.id,
--   a.alias,
--   'parked',
--   d.website_id,
--   a.domain_id,
--   NULL,
--   0,
--   'active',
--   unixepoch()
-- FROM domain_aliases a
-- JOIN domains d ON d.id = a.domain_id
-- WHERE NOT EXISTS (SELECT 1 FROM domains WHERE name = a.alias);