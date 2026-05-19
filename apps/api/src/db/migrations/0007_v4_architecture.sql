-- Migration: v4 Architecture Redesign
-- Creates the new normalized schema for multi-runtime support

-- ============================================================================
-- Phase 1: Core Tables
-- ============================================================================

-- sites: Minimal identity table (replaces websites)
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_user TEXT NOT NULL UNIQUE,
  home_dir TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
  disk_used_mb INTEGER NOT NULL DEFAULT 0,
  bandwidth_used_mb INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- site_runtimes: JSONB runtime configuration
CREATE TABLE IF NOT EXISTS site_runtimes (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  runtime_config TEXT NOT NULL, -- JSON: {"schemaVersion": 1, "runtime": "node", "version": "20", ...}
  web_server TEXT NOT NULL DEFAULT 'nginx' CHECK(web_server IN ('nginx', 'apache')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- site_processes: Process management with auto port allocation
CREATE TABLE IF NOT EXISTS site_processes (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  start_command TEXT NOT NULL,
  internal_port INTEGER, -- Auto-assigned by system, user NEVER sets this
  process_manager TEXT NOT NULL DEFAULT 'pm2' CHECK(process_manager IN ('pm2', 'supervisor', 'systemd', 'php-fpm')),
  replicas INTEGER NOT NULL DEFAULT 1,
  auto_restart INTEGER NOT NULL DEFAULT 1,
  health_check_path TEXT DEFAULT '/health',
  pid INTEGER,
  uptime INTEGER,
  restart_count INTEGER NOT NULL DEFAULT 0,
  memory_mb INTEGER,
  cpu_percent INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- domains: Role/behavior model with parent relationships (replaces old domains table)
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  parent_domain_id TEXT REFERENCES domains(id) ON DELETE CASCADE,
  
  -- Role: primary or attached
  role TEXT NOT NULL DEFAULT 'attached' CHECK(role IN ('primary', 'attached')),
  
  -- Behavior: normal, alias, or redirect
  behavior TEXT NOT NULL DEFAULT 'normal' CHECK(behavior IN ('normal', 'alias', 'redirect')),
  
  -- Subdomain flag (just a naming convention)
  is_subdomain INTEGER NOT NULL DEFAULT 0,
  
  -- Document root (nullable for alias/redirect)
  document_root TEXT,
  
  -- For redirect behavior
  redirect_target TEXT,
  
  -- SSL (references new ssl_certificates table)
  ssl_enabled INTEGER NOT NULL DEFAULT 1,
  ssl_cert_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending')),
  
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- site_states: Actual state tracking for reconciliation
CREATE TABLE IF NOT EXISTS site_states (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Nginx state
  nginx_status TEXT NOT NULL DEFAULT 'unknown' CHECK(nginx_status IN ('ok', 'missing', 'invalid', 'reload_needed', 'unknown')),
  nginx_config_valid INTEGER,
  nginx_reload_needed INTEGER NOT NULL DEFAULT 0,
  
  -- Process state
  process_status TEXT NOT NULL DEFAULT 'unknown' CHECK(process_status IN ('running', 'stopped', 'error', 'restarting', 'unknown')),
  process_running INTEGER,
  process_pid INTEGER,
  process_uptime INTEGER,
  process_restart_count INTEGER NOT NULL DEFAULT 0,
  
  -- Port allocation
  current_internal_port INTEGER,
  
  -- Deployment state
  deployed_commit_sha TEXT,
  last_deployment_status TEXT NOT NULL DEFAULT 'unknown' CHECK(last_deployment_status IN ('success', 'failed', 'pending', 'unknown')),
  last_deploy_at INTEGER,
  
  -- SSL state
  ssl_provisioned INTEGER NOT NULL DEFAULT 0,
  ssl_expires_at INTEGER,
  ssl_auto_renew INTEGER NOT NULL DEFAULT 1,
  
  -- DNS state
  dns_resolving INTEGER,
  dns_points_to_server INTEGER,
  
  -- Health
  last_health_check_at INTEGER,
  last_healthy_at INTEGER,
  
  -- Reconcile metadata
  last_reconcile_at INTEGER,
  reconcile_errors TEXT, -- JSON
  
  -- Observation timestamp
  observed_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- background_jobs: Async job queue with idempotency
CREATE TABLE IF NOT EXISTS background_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  
  -- Job state machine
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  result TEXT, -- JSON (success) or error message (failure)
  
  -- Idempotency
  dedupe_key TEXT UNIQUE,
  
  -- Retry configuration
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER,
  
  -- Progress
  progress INTEGER NOT NULL DEFAULT 0,
  progress_message TEXT
);

-- ssl_certificates: Certificate management (replaces old ssl table)
CREATE TABLE IF NOT EXISTS ssl_certificates (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  primary_domain TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('wildcard', 'single', 'san')),
  domains TEXT DEFAULT '[]', -- JSON array of strings
  cert_path TEXT NOT NULL,
  key_path TEXT NOT NULL,
  chain_path TEXT,
  le_wildcard INTEGER NOT NULL DEFAULT 0,
  le_account_id TEXT,
  issued_at INTEGER,
  expires_at INTEGER,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'revoked', 'pending')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- domain_ssl_bindings: Domain-certificate mappings
CREATE TABLE IF NOT EXISTS domain_ssl_bindings (
  id TEXT PRIMARY KEY,
  cert_id TEXT NOT NULL REFERENCES ssl_certificates(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL, -- References old domains table (will be updated later)
  is_primary INTEGER NOT NULL DEFAULT 0,
  validation_status TEXT NOT NULL DEFAULT 'valid' CHECK(validation_status IN ('pending', 'valid', 'failed')),
  http_challenge_path TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================================
-- Phase 2: Supporting Tables
-- ============================================================================

-- deployments: Deployment tracking with immutable structure
CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('git', 'archive', 'empty', 'rollback')),
  git_repo TEXT,
  git_branch TEXT DEFAULT 'main',
  commit_sha TEXT,
  commit_message TEXT,
  archive_path TEXT,
  deployment_path TEXT NOT NULL,
  build_status TEXT NOT NULL DEFAULT 'pending' CHECK(build_status IN ('pending', 'cloning', 'installing', 'building', 'testing', 'success', 'failed')),
  deploy_status TEXT NOT NULL DEFAULT 'pending' CHECK(deploy_status IN ('pending', 'deploying', 'success', 'failed', 'rolled_back')),
  build_logs TEXT,
  deploy_logs TEXT,
  logs_path TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER,
  deployed_at INTEGER
);

-- site_env_vars: Environment variables with scope
CREATE TABLE IF NOT EXISTS site_env_vars (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL, -- Encrypted
  scope TEXT NOT NULL DEFAULT 'runtime' CHECK(scope IN ('runtime', 'build', 'secret')),
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- site_health_checks: Health monitoring
CREATE TABLE IF NOT EXISTS site_health_checks (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  check_interval INTEGER DEFAULT 60,
  timeout INTEGER DEFAULT 10,
  healthy_threshold INTEGER DEFAULT 3,
  unhealthy_threshold INTEGER DEFAULT 3,
  check_path TEXT DEFAULT '/health',
  check_method TEXT DEFAULT 'GET' CHECK(check_method IN ('GET', 'HEAD')),
  is_enabled INTEGER NOT NULL DEFAULT 1,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  last_check_at INTEGER,
  last_check_duration INTEGER,
  last_check_status TEXT NOT NULL DEFAULT 'unknown' CHECK(last_check_status IN ('healthy', 'unhealthy', 'unknown')),
  last_check_error TEXT,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK(health_status IN ('healthy', 'unhealthy', 'unknown')),
  last_healthy_at INTEGER,
  last_unhealthy_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- activity_logs: Audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK(actor_type IN ('user', 'system', 'reconciler', 'job')),
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  action TEXT NOT NULL,
  metadata TEXT, -- JSON
  ip_address TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_site_runtimes_site_id ON site_runtimes(site_id);
CREATE INDEX IF NOT EXISTS idx_site_processes_site_id ON site_processes(site_id);
CREATE INDEX IF NOT EXISTS idx_domains_site_id ON domains(site_id);
CREATE INDEX IF NOT EXISTS idx_domains_parent_domain_id ON domains(parent_domain_id);
CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(name);
CREATE INDEX IF NOT EXISTS idx_site_states_site_id ON site_states(site_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_dedupe_key ON background_jobs(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(type);
CREATE INDEX IF NOT EXISTS idx_ssl_certificates_site_id ON ssl_certificates(site_id);
CREATE INDEX IF NOT EXISTS idx_ssl_certificates_primary_domain ON ssl_certificates(primary_domain);
CREATE INDEX IF NOT EXISTS idx_deployments_site_id ON deployments(site_id);
CREATE INDEX IF NOT EXISTS idx_deployments_sequence ON deployments(site_id, sequence);
CREATE INDEX IF NOT EXISTS idx_site_env_vars_site_id ON site_env_vars(site_id);
CREATE INDEX IF NOT EXISTS idx_site_health_checks_site_id ON site_health_checks(site_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================================
-- Migration: Copy data from old tables to new schema
-- This is a one-time migration and should be idempotent
-- ============================================================================

-- Copy websites to sites
-- Only copy if sites table is empty (idempotent)
INSERT OR IGNORE INTO sites (id, name, system_user, home_dir, status, disk_used_mb, bandwidth_used_mb, created_at)
SELECT id, name, system_user, home_dir, status, disk_used_mb, bandwidth_used_mb, created_at
FROM websites;

-- Copy website runtime as PHP default to site_runtimes
INSERT OR IGNORE INTO site_runtimes (id, site_id, runtime_config, web_server, created_at, updated_at)
SELECT 
  'rt_' || substr(id, 4) || '_1',
  id,
  json_object('schemaVersion', 1, 'runtime', 'php', 'version', php_version),
  CASE web_server WHEN 'apache' THEN 'apache' ELSE 'nginx' END,
  created_at,
  created_at
FROM websites;

-- Copy domains to new domains table (map old types to new role/behavior)
INSERT OR IGNORE INTO domains (id, name, site_id, parent_domain_id, role, behavior, is_subdomain, document_root, redirect_target, ssl_enabled, status, created_at, updated_at)
SELECT 
  id,
  name,
  website_id,
  parent_domain_id,
  CASE type 
    WHEN 'primary' THEN 'primary'
    ELSE 'attached'
  END,
  CASE type
    WHEN 'redirect' THEN 'redirect'
    WHEN 'parked' THEN 'normal' -- Parked becomes normal behavior
    ELSE 'normal'
  END,
  CASE WHEN type = 'subdomain' THEN 1 ELSE 0 END,
  document_root,
  redirect_target,
  ssl_enabled,
  status,
  created_at,
  unixepoch()
FROM domains;

-- ============================================================================
-- Deprecate old tables (don't drop yet - allow rollback)
-- The old tables will be dropped in a future migration after data verification
-- ============================================================================

-- Mark old tables as deprecated (for documentation purposes)
-- websites, domains, subdomains, domain_aliases, domain_redirects, ssl are deprecated