import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './client';

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ApiError', () => {
    it('creates error with code, message, and status', () => {
      const error = new ApiError('VALIDATION_ERROR', 'Invalid input', 400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.status).toBe(400);
      expect(error.name).toBe('ApiError');
    });

    it('includes optional field', () => {
      const error = new ApiError('VALIDATION_ERROR', 'Invalid email', 400, 'email');
      expect(error.field).toBe('email');
    });

    it('is instance of Error', () => {
      const error = new ApiError('TEST', 'Test', 500);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('api.get', () => {
    it('makes GET request to correct path', async () => {
      const mockResponse = {
        success: true,
        data: { id: '1', name: 'Test' },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch;

      const result = await api.get<{ id: string; name: string }>('/sites/1');
      expect(result).toEqual({ id: '1', name: 'Test' });
    });

    it('throws ApiError on error response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Site not found' },
        }),
      }) as unknown as typeof fetch;

      await expect(api.get('/sites/999')).rejects.toThrow(ApiError);
    });
  });

  describe('api.post', () => {
    it('makes POST request with body', async () => {
      const mockResponse = {
        success: true,
        data: { id: 'new-site', name: 'New Site' },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch;

      const result = await api.post<{ id: string; name: string }>('/sites', { name: 'New Site' });
      expect(result).toEqual({ id: 'new-site', name: 'New Site' });
    });
  });

  describe('api.put', () => {
    it('makes PUT request with body', async () => {
      const mockResponse = {
        success: true,
        data: { id: '1', name: 'Updated Site' },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch;

      const result = await api.put<{ id: string; name: string }>('/sites/1', { name: 'Updated Site' });
      expect(result).toEqual({ id: '1', name: 'Updated Site' });
    });
  });

  describe('api.delete', () => {
    it('makes DELETE request', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve({ success: true }),
      }) as unknown as typeof fetch;

      await expect(api.delete('/sites/1')).resolves.toBeUndefined();
    });
  });
});