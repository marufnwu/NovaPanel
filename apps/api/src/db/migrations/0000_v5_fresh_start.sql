-- NovaPanel v5 Fresh Start Migration
-- Drop all existing tables first
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `background_jobs`;
DROP TABLE IF EXISTS `site_health_checks`;
DROP TABLE IF EXISTS `site_env_vars`;
DROP TABLE IF EXISTS `deployments`;
DROP TABLE IF EXISTS `site_states`;
DROP TABLE IF EXISTS `site_processes`;
DROP TABLE IF EXISTS `site_runtimes`;
DROP TABLE IF EXISTS `domain_ssl_bindings`;
DROP TABLE IF EXISTS `backups`;
DROP TABLE IF EXISTS `backup_schedules`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `notification_preferences`;
DROP TABLE IF EXISTS `api_tokens`;
DROP TABLE IF EXISTS `cloudflare_redirect_rules`;
DROP TABLE IF EXISTS `cloudflare_zones`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `tunnel_routes`;
DROP TABLE IF EXISTS `cloudflare_tunnels`;
DROP TABLE IF EXISTS `cron_jobs`;
DROP TABLE IF EXISTS `cron_job_history`;
DROP TABLE IF EXISTS `ftp_accounts`;
DROP TABLE IF EXISTS `dns_records`;
DROP TABLE IF EXISTS `dns_zones`;
DROP TABLE IF EXISTS `mailboxes`;
DROP TABLE IF EXISTS `mail_forwards`;
DROP TABLE IF EXISTS `mail_aliases`;
DROP TABLE IF EXISTS `mail_domains`;
DROP TABLE IF EXISTS `databases`;
DROP TABLE IF EXISTS `database_users`;
DROP TABLE IF EXISTS `ssl_certificates`;
DROP TABLE IF EXISTS `domain_redirects`;
DROP TABLE IF EXISTS `domains`;
DROP TABLE IF EXISTS `sites`;
DROP TABLE IF EXISTS `server_stats`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `temp_tokens`;
DROP TABLE IF EXISTS `two_factor_backup_codes`;
DROP TABLE IF EXISTS `tunnels`;
DROP TABLE IF EXISTS `installed_apps`;

-- v5 Tables

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`locale` text DEFAULT 'en',
	`timezone` text DEFAULT 'UTC',
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_super_admin` integer DEFAULT false NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`two_factor_secret` text,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`password_changed_at` integer,
	`must_change_password` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`password_reset_token` text,
	`password_reset_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_activity_at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_agent` text,
	`ip_address` text,
	`remember_me` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE `temp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE `two_factor_backup_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`quotas` text DEFAULT '{}' NOT NULL,
	`branding` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);

CREATE TABLE `organization_members` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`invited_by` text,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`environment` text DEFAULT 'production' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions` text DEFAULT '[]' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`user_id` text,
	`name` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`rate_limit` integer DEFAULT 1000 NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`runtime` text NOT NULL,
	`runtime_version` text,
	`source_type` text DEFAULT 'empty' NOT NULL,
	`git_repo` text,
	`git_branch` text DEFAULT 'main',
	`git_webhook_secret` text,
	`build_command` text,
	`output_directory` text DEFAULT 'dist',
	`install_command` text,
	`start_command` text,
	`port` integer,
	`replicas` integer DEFAULT 1 NOT NULL,
	`auto_restart` integer DEFAULT true NOT NULL,
	`memory_limit` integer,
	`cpu_limit` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`health_check_path` text DEFAULT '/health',
	`last_deployment_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`source_type` text,
	`git_ref` text,
	`commit_sha` text,
	`commit_message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`build_logs` text,
	`deploy_logs` text,
	`deployed_at` integer,
	`duration_ms` integer,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE
);

CREATE TABLE `site_env_vars` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`scope` text DEFAULT 'runtime' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE
);

CREATE TABLE `site_health_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`path` text DEFAULT '/health',
	`interval` integer DEFAULT 30,
	`timeout` integer DEFAULT 5,
	`healthy_threshold` integer DEFAULT 1,
	`unhealthy_threshold` integer DEFAULT 3,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE
);

CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`site_id` text,
	`name` text NOT NULL,
	`type` text DEFAULT 'apex' NOT NULL,
	`dns_zone_id` text,
	`nameservers` text,
	`dnssec_enabled` integer DEFAULT false NOT NULL,
	`ssl_status` text DEFAULT 'pending' NOT NULL,
	`ssl_cert_id` text,
	`ssl_auto_renew` integer DEFAULT true NOT NULL,
	`force_https` integer DEFAULT true NOT NULL,
	`hsts_enabled` integer DEFAULT false NOT NULL,
	`proxy_enabled` integer DEFAULT true NOT NULL,
	`custom_nginx_config` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `ssl_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`type` text NOT NULL,
	`cert_pem` text,
	`key_pem` text,
	`chain_pem` text,
	`issued_at` integer,
	`expires_at` integer,
	`auto_renew` integer DEFAULT true NOT NULL,
	`renewal_days_before_expiry` integer DEFAULT 14 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON DELETE CASCADE
);

CREATE TABLE `databases` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`version` text,
	`host` text DEFAULT 'localhost',
	`port` integer,
	`database_name` text,
	`username` text,
	`password` text,
	`container_id` text,
	`volume_id` text,
	`backups_enabled` integer DEFAULT true NOT NULL,
	`backup_schedule` text DEFAULT '0 2 * * *',
	`public_access` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `database_users` (
	`id` text PRIMARY KEY NOT NULL,
	`database_id` text NOT NULL,
	`username` text NOT NULL,
	`password` text,
	`privileges` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`database_id`) REFERENCES `databases`(`id`) ON DELETE CASCADE
);

CREATE TABLE `dns_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`name` text NOT NULL,
	`soa` text,
	`ns_records` text,
	`dnssec_enabled` integer DEFAULT false NOT NULL,
	`dnssec_keys` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `dns_records` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`ttl` integer DEFAULT 3600 NOT NULL,
	`priority` integer,
	`weight` integer,
	`port` integer,
	`proxied` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`zone_id`) REFERENCES `dns_zones`(`id`) ON DELETE CASCADE
);

CREATE TABLE `ftp_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`database_id` text,
	`site_id` text,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`home_dir` text NOT NULL,
	`quota` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `cron_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`site_id` text,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`schedule` text NOT NULL,
	`user` text DEFAULT 'root',
	`working_dir` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_run_at` integer,
	`last_exit_code` integer,
	`next_run_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `cron_history` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`exit_code` integer,
	`output` text,
	`error` text
);

CREATE TABLE `containers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`compose_file` text,
	`dockerfile` text,
	`image` text,
	`env` text DEFAULT '{}' NOT NULL,
	`secrets` text DEFAULT '[]' NOT NULL,
	`network_mode` text DEFAULT 'bridge',
	`exposed_ports` text DEFAULT '[]' NOT NULL,
	`cpu_limit` integer,
	`memory_limit` integer,
	`replicas` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'stopped' NOT NULL,
	`container_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `container_volumes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer,
	`mount_point` text,
	`driver` text DEFAULT 'local',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `registries` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`url` text,
	`username` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`region` text DEFAULT 'default',
	`public_access` integer DEFAULT false NOT NULL,
	`versioning` integer DEFAULT false NOT NULL,
	`cors_rules` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `storage_access_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`access_key_id` text NOT NULL UNIQUE,
	`secret_key_hash` text NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `waf_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `ip_allowlists` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`ips` text DEFAULT '[]' NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`type` text DEFAULT 'full' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`size` integer,
	`path` text,
	`storage_backend` text DEFAULT 'local' NOT NULL,
	`storage_path` text,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer
);

CREATE TABLE `backup_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`cron_expression` text NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`storage_backend` text DEFAULT 'local' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`quantity` integer NOT NULL,
	`unit` text NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`line_items` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`price` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`interval` text DEFAULT 'monthly' NOT NULL,
	`quotas` text NOT NULL,
	`features` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`labels` text DEFAULT '{}' NOT NULL,
	`value` integer NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`description` text,
	`metric` text NOT NULL,
	`condition` text NOT NULL,
	`threshold` integer NOT NULL,
	`duration` integer DEFAULT 60 NOT NULL,
	`channels` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `alert_history` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`triggered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	`value` integer NOT NULL,
	`message` text
);

CREATE TABLE `plugins` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`description` text,
	`author` text,
	`manifest` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`secret` text,
	`events` text NOT NULL DEFAULT '[]',
	`enabled` integer DEFAULT true NOT NULL,
	`headers` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`response_status` integer,
	`response_body` text,
	`success` integer NOT NULL,
	`error` text,
	`delivered_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `firewall_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`action` text NOT NULL,
	`protocol` text DEFAULT 'tcp' NOT NULL,
	`port` text,
	`source` text,
	`destination` text,
	`comment` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `mailboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`username` text NOT NULL,
	`password` text,
	`quota` integer DEFAULT 5120,
	`aliases` text DEFAULT '[]' NOT NULL,
	`forwards` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `cloudflare_tunnels` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`tunnel_token` text,
	`status` text DEFAULT 'inactive' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `cloudflare_dns` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`record_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`proxied` integer DEFAULT false NOT NULL,
	`auto_sync` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `tunnels` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `installed_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`site_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`version` text,
	`config` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'installing' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);

CREATE TABLE `background_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `server_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`cpu_percent` integer NOT NULL,
	`memory_percent` integer NOT NULL,
	`memory_used_mb` integer NOT NULL,
	`memory_total_mb` integer NOT NULL,
	`disk_percent` integer NOT NULL,
	`disk_used_mb` integer NOT NULL,
	`disk_total_mb` integer NOT NULL,
	`load_average` text,
	`network_in` integer DEFAULT 0 NOT NULL,
	`network_out` integer DEFAULT 0 NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`site_id` text,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`details` text,
	`ip_address` text,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);