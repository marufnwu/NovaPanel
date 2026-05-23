import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setBreadcrumbOverride, clearBreadcrumbOverride, getBreadcrumbOverrides } from './breadcrumb-store';

describe('breadcrumb-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearBreadcrumbOverride('/sites');
    clearBreadcrumbOverride('/databases');
    clearBreadcrumbOverride('/test');
  });

  describe('setBreadcrumbOverride', () => {
    it('sets a breadcrumb override', () => {
      setBreadcrumbOverride('/sites', 'My Sites');
      const overrides = getBreadcrumbOverrides();
      expect(overrides.get('/sites')).toBe('My Sites');
    });

    it('overwrites existing override for same path', () => {
      setBreadcrumbOverride('/sites', 'My Sites');
      setBreadcrumbOverride('/sites', 'Updated Sites');
      const overrides = getBreadcrumbOverrides();
      expect(overrides.get('/sites')).toBe('Updated Sites');
    });
  });

  describe('clearBreadcrumbOverride', () => {
    it('removes a breadcrumb override', () => {
      setBreadcrumbOverride('/sites', 'My Sites');
      clearBreadcrumbOverride('/sites');
      const overrides = getBreadcrumbOverrides();
      expect(overrides.has('/sites')).toBe(false);
    });
  });

  describe('getBreadcrumbOverrides', () => {
    it('returns empty map initially', () => {
      const overrides = getBreadcrumbOverrides();
      expect(overrides.size).toBe(0);
    });

    it('returns all set overrides', () => {
      setBreadcrumbOverride('/sites', 'Sites');
      setBreadcrumbOverride('/databases', 'Databases');
      const overrides = getBreadcrumbOverrides();
      expect(overrides.get('/sites')).toBe('Sites');
      expect(overrides.get('/databases')).toBe('Databases');
    });
  });
});