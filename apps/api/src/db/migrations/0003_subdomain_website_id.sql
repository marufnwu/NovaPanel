-- Add optional websiteId column to subdomains table
-- This allows subdomains to be attached to a different website than their parent domain
-- When websiteId is NULL, subdomain uses the parent domain's website (existing behavior)
-- When websiteId is set, subdomain uses its own websiteId

ALTER TABLE subdomains ADD COLUMN website_id TEXT REFERENCES websites(id) ON DELETE SET NULL;