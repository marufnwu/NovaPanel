DROP TABLE IF EXISTS old_domains;
DROP TABLE IF EXISTS subdomains;
DROP TABLE IF EXISTS domain_aliases;
DROP TABLE IF EXISTS addon_domains;
DROP TABLE IF EXISTS websites;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS plans;

DROP TABLE IF EXISTS domains;
CREATE TABLE domains (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'primary' CHECK(type IN ('primary','addon','parked','subdomain','redirect','mail-only')),
  is_primary INTEGER NOT NULL DEFAULT 0, parent_domain_id TEXT,
  document_root TEXT, php_version TEXT NOT NULL DEFAULT '8.2',
  php_handler TEXT NOT NULL DEFAULT 'php-fpm' CHECK(php_handler IN ('php-fpm','cgi','disabled')),
  web_server TEXT NOT NULL DEFAULT 'nginx+apache' CHECK(web_server IN ('nginx','apache','nginx+apache')),
  redirect_target TEXT, redirect_type TEXT DEFAULT '301' CHECK(redirect_type IN ('301','302')),
  ssl_enabled INTEGER NOT NULL DEFAULT 0, ssl_cert_id TEXT,
  redirect_http_to_https INTEGER NOT NULL DEFAULT 0, hsts INTEGER NOT NULL DEFAULT 0,
  suspended_config TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','pending')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER
);
CREATE INDEX idx_domains_site_id ON domains(site_id);
CREATE INDEX idx_domains_type ON domains(type);
CREATE INDEX idx_domains_status ON domains(status);
CREATE UNIQUE INDEX idx_domains_name_unique ON domains(name);
CREATE INDEX idx_domains_parent_id ON domains(parent_domain_id);
