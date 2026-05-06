-- Cloudflare integration tables
CREATE TABLE `cloudflare_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`domain_id` text,
	`zone_id` text,
	`zone_name` text NOT NULL,
	`account_id` text,
	`api_token` text,
	`plan` text,
	`status` text DEFAULT 'active',
	`ssl_mode` text DEFAULT 'flexible',
	`is_paused` integer DEFAULT 0,
	`nameservers` text,
	`last_sync_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `cloudflare_redirect_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_id` text NOT NULL,
	`rule_id` text,
	`source_pattern` text NOT NULL,
	`destination_url` text NOT NULL,
	`redirect_type` text DEFAULT '301',
	`is_active` integer DEFAULT 1,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`zone_id`) REFERENCES `cloudflare_zones`(`id`) ON UPDATE no action ON DELETE cascade
);
