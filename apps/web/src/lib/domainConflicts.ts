import { api } from '../api/client';

export interface DomainConflictResult {
  available: boolean;
  reason?: string;
  conflictType?: 'primary' | 'alias' | 'subdomain' | 'site';
  siteId?: string;
  siteName?: string;
  domainId?: string;
}

/**
 * Check if a domain is already being used as a primary domain of another site.
 */
export async function checkDomainAvailability(domain: string): Promise<DomainConflictResult> {
  try {
    const response = await api.post<DomainConflictResult>('/domains/check-conflict', {
      domain,
      type: 'primary',
    });
    return response;
  } catch (error: any) {
    // If the API returns 404 or conflict info, parse it
    if (error.status === 409) {
      return {
        available: false,
        reason: error.message || 'Domain is already in use',
        conflictType: 'primary',
      };
    }
    // For other errors, assume domain is available (fail open)
    console.error('Domain availability check failed:', error);
    return { available: true };
  }
}

/**
 * Check if a subdomain is already a separate site (created via subdomain flow).
 */
export async function checkSubdomainAvailability(
  subdomain: string,
  parentDomain: string
): Promise<DomainConflictResult> {
  try {
    const fullDomain = `${subdomain}.${parentDomain}`;
    const response = await api.post<DomainConflictResult>('/domains/check-conflict', {
      domain: fullDomain,
      type: 'subdomain',
    });
    return response;
  } catch (error: any) {
    if (error.status === 409) {
      return {
        available: false,
        reason: 'Already a separate site',
        conflictType: 'site',
        siteId: error.siteId,
        siteName: error.siteName,
      };
    }
    console.error('Subdomain availability check failed:', error);
    return { available: true };
  }
}

/**
 * Check if a domain is already an alias on another site.
 */
export async function checkAliasAvailability(alias: string): Promise<DomainConflictResult> {
  try {
    const response = await api.post<DomainConflictResult>('/domains/check-conflict', {
      domain: alias,
      type: 'alias',
    });
    return response;
  } catch (error: any) {
    if (error.status === 409) {
      return {
        available: false,
        reason: `Already an alias for another site`,
        conflictType: 'alias',
        siteName: error.siteName,
      };
    }
    console.error('Alias availability check failed:', error);
    return { available: true };
  }
}

/**
 * Combined check for any type of domain conflict.
 */
export async function checkAnyDomainConflict(
  domain: string
): Promise<DomainConflictResult> {
  try {
    const response = await api.post<DomainConflictResult>('/domains/check-conflict', {
      domain,
    });
    return response;
  } catch (error: any) {
    if (error.status === 409) {
      return {
        available: false,
        reason: error.message || 'Domain is already in use',
        conflictType: error.conflictType || 'primary',
        siteId: error.siteId,
        siteName: error.siteName,
        domainId: error.domainId,
      };
    }
    console.error('Domain conflict check failed:', error);
    return { available: true };
  }
}