/**
 * Error Message Transformation Utility
 * 
 * Transforms raw technical errors from SSL, tunnel, and DNS operations
 * into human-readable messages with suggested next steps.
 */

import { AppError } from '../errors.js';

export type SslErrorType = 'connection' | 'dns' | 'rate_limit' | 'validation' | 'config' | 'unknown';
export type TunnelErrorType = 'auth' | 'network' | 'dns' | 'config' | 'unknown';
export type DnsErrorType = 'propagation' | 'zone' | 'record' | 'unknown';

export interface SslErrorResult {
	title: string;
	message: string;
	suggestion: string;
	errorType: SslErrorType;
}

export interface TunnelErrorResult {
	title: string;
	message: string;
	suggestion: string;
	errorType: TunnelErrorType;
}

export interface DnsErrorResult {
	title: string;
	message: string;
	suggestion: string;
	errorType: DnsErrorType;
}

/**
 * Extended error class that includes structured error information
 * for human-readable error messages and debugging details.
 */
export class StructuredError extends AppError {
	constructor(
		statusCode: number,
		code: string,
		message: string,
		public title: string,
		public suggestion: string,
		public cause?: string
	) {
		super(statusCode, code, message);
		this.name = 'StructuredError';
	}
}

/**
 * Transform SSL/certbot errors into human-readable messages
 */
export function transformSslError(rawError: string): SslErrorResult {
	const error = rawError.toLowerCase();

	// Connection/refused/timeout errors
	if (error.includes('connection') || error.includes('refused') || error.includes('timeout')) {
		return {
			title: 'Cannot reach server',
			message: "Let's Encrypt couldn't reach your server to verify your domain. This usually means your server doesn't have a public IP address or port 80 is blocked by a firewall.",
			suggestion: 'Try using the DNS-01 challenge instead, which verifies domain ownership through DNS records rather than HTTP requests.',
			errorType: 'connection',
		};
	}

	// DNS resolution errors
	if (error.includes('dns') || error.includes('nxdomain') || error.includes('servfail')) {
		return {
			title: 'DNS not configured',
			message: "DNS for this domain doesn't resolve correctly. Let's Encrypt cannot find your server through DNS lookup.",
			suggestion: 'Ensure DNS is properly configured and propagated before issuing a certificate. You may need to wait for DNS propagation (up to 48 hours) or use DNS-01 challenge.',
			errorType: 'dns',
		};
	}

	// Rate limiting errors
	if (error.includes('rate') || error.includes('too many')) {
		return {
			title: 'Rate limit exceeded',
			message: "You've hit Let's Encrypt's rate limit for certificate issuance. Let's Encrypt limits how many certificates can be issued per domain.",
			suggestion: 'Wait a few hours before trying again. To prevent this, avoid repeatedly issuing certificates for the same domain.',
			errorType: 'rate_limit',
		};
	}

	// Validation/unauthorized errors
	if (error.includes('validation') || error.includes('unauthorized') || error.includes('rejected')) {
		return {
			title: 'Domain validation failed',
			message: "Let's Encrypt couldn't verify that you own this domain. This can happen if the domain name is incorrect or doesn't point to this server.",
			suggestion: 'Check that the domain name is correct and that DNS A/AAAA records point to this server. For HTTP-01 challenge, port 80 must be accessible.',
			errorType: 'validation',
		};
	}

	// Certbot not installed
	if (error.includes('certbot') && (error.includes('not found') || error.includes('command not found') || error.includes('no such file'))) {
		return {
			title: 'Certbot not installed',
			message: 'The certbot tool is not installed on your server. Certbot is required to issue SSL certificates from Let\'s Encrypt.',
			suggestion: 'Run the installation script to install certbot and its dependencies: ./scripts/install.sh',
			errorType: 'config',
		};
	}

	// Generic fallback
	return {
		title: 'SSL certificate issue failed',
		message: 'An error occurred while trying to issue an SSL certificate.',
		suggestion: 'Check the raw error for more details. Ensure your domain DNS is properly configured and port 80 is accessible.',
		errorType: 'unknown',
	};
}

/**
 * Transform tunnel/Cloudflare errors into human-readable messages
 */
export function transformTunnelError(rawError: string): TunnelErrorResult {
	const error = rawError.toLowerCase();

	// Auth/unauthorized errors
	if (error.includes('auth') || error.includes('unauthorized') || error.includes('invalid') || error.includes('forbidden')) {
		return {
			title: 'Authentication failed',
			message: 'Cloudflare API authentication failed. Your API token may be invalid, expired, or lack the required permissions.',
			suggestion: 'Check that your Cloudflare API token is valid and has permissions for Zone Settings, DNS, and Tunnel. Regenerate the token if necessary.',
			errorType: 'auth',
		};
	}

	// DNS/CNAME record errors
	if (error.includes('dns') || error.includes('cname') || error.includes('record exists') || error.includes('record already exists')) {
		return {
			title: 'DNS record conflict',
			message: 'A DNS record for this domain may already exist in Cloudflare. This creates a conflict when trying to set up the tunnel.',
			suggestion: 'Check your Cloudflare DNS settings and remove any existing CNAME records for this domain, or use a different subdomain for the tunnel.',
			errorType: 'dns',
		};
	}

	// Tunnel not found/not exists
	if (error.includes('tunnel not found') || error.includes('not exist') || error.includes('does not exist') || error.includes('not exist')) {
		return {
			title: 'Tunnel not found',
			message: "The tunnel doesn't exist in your Cloudflare account. It may have been deleted from the Cloudflare dashboard or never created.",
			suggestion: 'Create a new tunnel through NovaPanel or manually in Cloudflare Zero Trust dashboard, then try again.',
			errorType: 'network',
		};
	}

	// Cloudflared not installed
	if (error.includes('cloudflared') && (error.includes('not found') || error.includes('command not found') || error.includes('no such file'))) {
		return {
			title: 'Cloudflared not installed',
			message: 'The cloudflared tunnel client is not installed on your server. Cloudflared is required to create and manage tunnels.',
			suggestion: 'Run the installation script to install cloudflared: ./scripts/install.sh',
			errorType: 'config',
		};
	}

	// Network/connectivity errors
	if (error.includes('network') || error.includes('connect') || error.includes('econnrefused') || error.includes('etimedout')) {
		return {
			title: 'Network error',
			message: 'Could not connect to Cloudflare API or tunnel service. This may be due to network connectivity issues.',
			suggestion: 'Check your server\'s internet connection and ensure outbound HTTPS (port 443) is allowed. Verify Cloudflare status is normal.',
			errorType: 'network',
		};
	}

	// Generic fallback
	return {
		title: 'Tunnel operation failed',
		message: 'An error occurred while trying to manage the Cloudflare tunnel.',
		suggestion: 'Check the raw error for more details. Ensure cloudflared is installed and your Cloudflare API token has correct permissions.',
		errorType: 'unknown',
	};
}

/**
 * Transform DNS errors into human-readable messages
 */
export function transformDnsError(rawError: string): DnsErrorResult {
	const error = rawError.toLowerCase();

	// Propagation/not found errors
	if (error.includes('propagation') || error.includes('not found') || error.includes('nxdomain') || error.includes('servfail')) {
		return {
			title: 'DNS not propagated',
			message: "DNS changes may not have propagated across the internet yet. DNS propagation can take anywhere from a few minutes to 48 hours.",
			suggestion: 'Wait for DNS propagation to complete. Note: If your server uses a private IP address (e.g., 192.168.x.x), external DNS propagation will not work and you\'ll need a public IP or use a different approach.',
			errorType: 'propagation',
		};
	}

	// Zone already exists
	if (error.includes('zone') && (error.includes('already exists') || error.includes('exist') || error.includes('created'))) {
		return {
			title: 'DNS zone already exists',
			message: 'A DNS zone for this domain already exists in the DNS server configuration.',
			suggestion: 'No action needed if this zone is already managed by this server. If you want to re-create it, delete the existing zone first.',
			errorType: 'zone',
		};
	}

	// Record conflict
	if (error.includes('record') && (error.includes('conflict') || error.includes('already exists') || error.includes('exist'))) {
		return {
			title: 'DNS record conflict',
			message: 'A DNS record with this name and type already exists. Duplicate records can cause conflicts and unexpected behavior.',
			suggestion: 'Update the existing record instead of creating a new one, or use a different record name/type combination.',
			errorType: 'record',
		};
	}

	// SOA/serial errors
	if (error.includes('soa') || error.includes('serial')) {
		return {
			title: 'DNS zone configuration error',
			message: 'There is an issue with the DNS zone configuration, possibly related to zone transfer or serial numbers.',
			suggestion: 'Check the zone file configuration and ensure the SOA record serial is correctly formatted. Try reloading or restarting the DNS service.',
			errorType: 'zone',
		};
	}

	// Generic fallback
	return {
		title: 'DNS operation failed',
		message: 'An error occurred while trying to perform a DNS operation.',
		suggestion: 'Check the raw error for more details. Verify DNS configuration and ensure the DNS service is running.',
		errorType: 'unknown',
	};
}

/**
 * Create a structured error with transformed error information
 */
export function createSslError(rawError: string, code: string = 'SSL_ERROR'): StructuredError {
	const transformed = transformSslError(rawError);
	return new StructuredError(
		422,
		`${code}_${transformed.errorType.toUpperCase()}`,
		transformed.message,
		transformed.title,
		transformed.suggestion,
		rawError
	);
}

/**
 * Create tunnel error structure
 */
export function createTunnelError(rawError: string, code: string = 'TUNNEL_ERROR'): StructuredError {
	const transformed = transformTunnelError(rawError);
	return new StructuredError(
		422,
		`${code}_${transformed.errorType.toUpperCase()}`,
		transformed.message,
		transformed.title,
		transformed.suggestion,
		rawError
	);
}

/**
 * Create DNS error structure
 */
export function createDnsError(rawError: string, code: string = 'DNS_ERROR'): StructuredError {
	const transformed = transformDnsError(rawError);
	return new StructuredError(
		422,
		`${code}_${transformed.errorType.toUpperCase()}`,
		transformed.message,
		transformed.title,
		transformed.suggestion,
		rawError
	);
}