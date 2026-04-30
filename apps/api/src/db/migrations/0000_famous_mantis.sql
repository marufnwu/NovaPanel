CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`two_factor_secret` text,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`api_token_hash` text,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`password_changed_at` integer,
	`must_change_password` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`password_reset_token` text,
	`password_reset_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `temp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `two_factor_backup_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`max_domains` integer DEFAULT -1 NOT NULL,
	`max_disk_mb` integer DEFAULT -1 NOT NULL,
	`max_bandwidth_mb` integer DEFAULT -1 NOT NULL,
	`max_databases` integer DEFAULT -1 NOT NULL,
	`max_email_accounts` integer DEFAULT -1 NOT NULL,
	`max_ftp_accounts` integer DEFAULT -1 NOT NULL,
	`php_versions` text,
	`ssl_enabled` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_name_unique` ON `plans` (`name`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`system_user` text NOT NULL,
	`home_dir` text NOT NULL,
	`disk_used_mb` integer DEFAULT 0 NOT NULL,
	`bandwidth_used_mb` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_system_user_unique` ON `subscriptions` (`system_user`);--> statement-breakpoint
CREATE TABLE `websites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`system_user` text NOT NULL,
	`document_root` text NOT NULL,
	`php_version` text DEFAULT '8.2' NOT NULL,
	`php_handler` text DEFAULT 'php-fpm' NOT NULL,
	`web_server` text DEFAULT 'nginx+apache' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`disk_used_mb` integer DEFAULT 0 NOT NULL,
	`bandwidth_used_mb` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `websites_system_user_unique` ON `websites` (`system_user`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`document_root` text NOT NULL,
	`system_user` text,
	`php_version` text DEFAULT '8.2' NOT NULL,
	`php_handler` text DEFAULT 'php-fpm' NOT NULL,
	`web_server` text DEFAULT 'nginx+apache' NOT NULL,
	`ssl_enabled` integer DEFAULT false NOT NULL,
	`ssl_cert_id` text,
	`redirect_http_to_https` integer DEFAULT false NOT NULL,
	`hsts` integer DEFAULT false NOT NULL,
	`disk_used_mb` integer DEFAULT 0 NOT NULL,
	`bandwidth_used_mb` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`type` text DEFAULT 'primary' NOT NULL,
	`website_id` text,
	`redirect_target` text,
	`parent_domain_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_name_unique` ON `domains` (`name`);--> statement-breakpoint
CREATE TABLE `subdomains` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`name` text NOT NULL,
	`document_root` text NOT NULL,
	`php_version` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `domain_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`alias` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_aliases_alias_unique` ON `domain_aliases` (`alias`);--> statement-breakpoint
CREATE TABLE `domain_redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`source_path` text NOT NULL,
	`target_url` text NOT NULL,
	`type` text DEFAULT '301' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ssl_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text,
	`type` text NOT NULL,
	`certificate` text,
	`private_key` text,
	`chain` text,
	`san_domains` text,
	`is_wildcard` integer DEFAULT false,
	`expires_at` integer,
	`auto_renew` integer DEFAULT true,
	`last_renewed_at` integer,
	`renewal_fail_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `databases` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text,
	`website_id` text,
	`name` text NOT NULL,
	`engine` text DEFAULT 'mariadb' NOT NULL,
	`charset` text DEFAULT 'utf8mb4',
	`collation` text DEFAULT 'utf8mb4_unicode_ci',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `database_users` (
	`id` text PRIMARY KEY NOT NULL,
	`database_id` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`host` text DEFAULT 'localhost',
	`privileges` text DEFAULT 'ALL',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`database_id`) REFERENCES `databases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mail_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`is_active` integer DEFAULT true,
	`catch_all_destination` text,
	`spf_record` text,
	`dkim_public_key` text,
	`dkim_private_key` text,
	`dmarc_policy` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`mail_domain_id` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`quota_mb` integer DEFAULT 1024,
	`used_mb` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`is_suspended` integer DEFAULT false,
	`autoresponder` integer DEFAULT false,
	`autoresponder_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mail_domain_id`) REFERENCES `mail_domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mail_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`mail_domain_id` text NOT NULL,
	`alias` text NOT NULL,
	`destination` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mail_domain_id`) REFERENCES `mail_domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mail_forwards` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`forward_to` text NOT NULL,
	`keep_copy` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dns_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`serial` integer NOT NULL,
	`ttl` integer DEFAULT 3600,
	`primary_ns` text NOT NULL,
	`admin_email` text NOT NULL,
	`refresh` integer DEFAULT 86400,
	`retry` integer DEFAULT 7200,
	`expire` integer DEFAULT 3600000,
	`minimum_ttl` integer DEFAULT 172800,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dns_records` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`ttl` integer DEFAULT 3600,
	`priority` integer,
	`is_system` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`zone_id`) REFERENCES `dns_zones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ftp_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text NOT NULL,
	`website_id` text,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`home_dir` text NOT NULL,
	`readonly` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`last_login_at` integer,
	`last_login_ip` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ftp_accounts_username_unique` ON `ftp_accounts` (`username`);--> statement-breakpoint
CREATE TABLE `cron_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text,
	`website_id` text,
	`command` text NOT NULL,
	`schedule` text NOT NULL,
	`system_user` text NOT NULL,
	`is_active` integer DEFAULT true,
	`last_run` integer,
	`last_status` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `cloudflare_tunnels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tunnel_id` text,
	`account_id` text,
	`api_token` text,
	`credentials_json` text,
	`status` text DEFAULT 'inactive',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tunnel_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`tunnel_id` text NOT NULL,
	`hostname` text NOT NULL,
	`service` text NOT NULL,
	`domain_id` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tunnel_id`) REFERENCES `cloudflare_tunnels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource` text,
	`details` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `server_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`cpu_usage` real NOT NULL,
	`memory_used` integer NOT NULL,
	`memory_total` integer NOT NULL,
	`disk_used` integer NOT NULL,
	`disk_total` integer NOT NULL,
	`network_rx` integer DEFAULT 0,
	`network_tx` integer DEFAULT 0,
	`load_avg_1` real,
	`load_avg_5` real,
	`load_avg_15` real,
	`uptime` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backup_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text,
	`cron_expression` text DEFAULT '0 2 * * *' NOT NULL,
	`scope` text DEFAULT 'full' NOT NULL,
	`retention_count` integer DEFAULT 7 NOT NULL,
	`storage_type` text DEFAULT 'local' NOT NULL,
	`storage_config` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`website_id` text,
	`filename` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`type` text DEFAULT 'full' NOT NULL,
	`storage_type` text DEFAULT 'local' NOT NULL,
	`storage_path` text,
	`checksum` text,
	`encrypted` integer DEFAULT false NOT NULL,
	`encryption_algorithm` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `installed_apps` (
	`id` integer PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`app_name` text NOT NULL,
	`domain_id` text,
	`website_id` text,
	`install_path` text,
	`status` text DEFAULT 'installing' NOT NULL,
	`progress` integer DEFAULT 0,
	`admin_email` text,
	`admin_password` text,
	`database_host` text,
	`database_name` text,
	`database_user` text,
	`database_password` text,
	`installed_at` integer,
	`updated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installed_apps_app_id_unique` ON `installed_apps` (`app_id`);--> statement-breakpoint
CREATE TABLE `app_install_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`app_id` text,
	`domain_id` text,
	`message` text,
	`level` text DEFAULT 'info',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_configurations` (
	`id` integer PRIMARY KEY NOT NULL,
	`app_id` text,
	`config_key` text,
	`config_value` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`push_enabled` integer DEFAULT false NOT NULL,
	`ssl_expiry` integer DEFAULT true NOT NULL,
	`backup_complete` integer DEFAULT true NOT NULL,
	`cron_failed` integer DEFAULT true NOT NULL,
	`security_alert` integer DEFAULT true NOT NULL,
	`disk_space_low` integer DEFAULT true NOT NULL,
	`service_down` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
