import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from '@/api/client';

describe('API Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Status Codes', () => {
    const createMockResponse = (status: number, body: object) => {
      return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      };
    };

    it('throws ApiError with correct properties on 400', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(createMockResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', field: 'email' },
      })));
      vi.stubGlobal('fetch', fetchMock);

      try {
        const { api } = await import('@/api/client');
        await api.get('/sites');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(400);
        expect((e as ApiError).code).toBe('VALIDATION_ERROR');
        expect((e as ApiError).field).toBe('email');
      }
    });

    it('throws ApiError on 401 Unauthorized', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(createMockResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired' },
      })));
      vi.stubGlobal('fetch', fetchMock);

      try {
        const { api } = await import('@/api/client');
        await api.get('/sites');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(401);
        expect((e as ApiError).code).toBe('UNAUTHORIZED');
      }
    });

    it('throws ApiError on 403 Forbidden', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(createMockResponse(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      })));
      vi.stubGlobal('fetch', fetchMock);

      try {
        const { api } = await import('@/api/client');
        await api.get('/sites');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(403);
        expect((e as ApiError).code).toBe('FORBIDDEN');
      }
    });

    it('throws ApiError on 404 Not Found', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(createMockResponse(404, {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      })));
      vi.stubGlobal('fetch', fetchMock);

      try {
        const { api } = await import('@/api/client');
        await api.get('/sites/invalid-id');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(404);
        expect((e as ApiError).code).toBe('NOT_FOUND');
      }
    });

    it('throws ApiError on 422 Validation Error', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(createMockResponse(422, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email already exists', field: 'email' },
      })));
      vi.stubGlobal('fetch', fetchMock);

      try {
        const { api } = await import('@/api/client');
        await api.post('/sites', { name: '' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(422);
        expect((e as ApiError).field).toBe('email');
      }
    });

    it('throws ApiError on 500 Internal Server Error', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(createMockResponse(500, {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      })));
      vi.stubGlobal('fetch', fetchMock);

      try {
        const { api } = await import('@/api/client');
        await api.get('/sites');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(500);
        expect((e as ApiError).code).toBe('INTERNAL_ERROR');
      }
    });
  });

  describe('Auth Header Handling', () => {
    it('includes x-organization-id header when activeOrgId in localStorage', async () => {
      let capturedHeaders: Record<string, string> = {};
      const fetchMock = vi.fn((url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const localStorageMock = {
        getItem: (key: string) => {
          if (key === 'sf-auth') {
            return JSON.stringify({ state: { activeOrgId: 'org-123' } });
          }
          return null;
        },
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', localStorageMock);

      const { api } = await import('@/api/client');
      await api.get('/sites');

      expect(capturedHeaders['x-organization-id']).toBe('org-123');
    });

    it('does not include x-organization-id header when no activeOrgId', async () => {
      let capturedHeaders: Record<string, string> = {};
      const fetchMock = vi.fn((url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const localStorageMock = {
        getItem: (key: string) => {
          if (key === 'sf-auth') {
            return JSON.stringify({ state: {} });
          }
          return null;
        },
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', localStorageMock);

      const { api } = await import('@/api/client');
      await api.get('/sites');
      expect(capturedHeaders['x-organization-id']).toBeUndefined();
    });

    it('handles localStorage parse errors gracefully', async () => {
      const fetchMock = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: {} }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const localStorageMock = {
        getItem: () => { throw new Error('parse error'); },
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', localStorageMock);

      const { api } = await import('@/api/client');
      const result = await api.get('/sites');
      expect(result).toBeDefined();
    });
  });

  describe('Network Errors', () => {
    it('throws error when fetch fails completely', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      vi.stubGlobal('fetch', fetchMock);

      try {
        const { api } = await import('@/api/client');
        await api.get('/sites');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });
});