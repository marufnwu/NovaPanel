import { test, expect } from '@playwright/test';

test.describe('Health & Auth', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get('/api/v1/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });
});