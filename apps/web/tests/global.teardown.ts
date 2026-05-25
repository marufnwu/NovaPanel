import { fullTrace } from 'playwright-core';

export default async function globalTeardown(config: any, projectInfo: any) {
  console.log('Cleaning up test data...');

  const baseUrl = 'http://192.168.0.212:8732';

  async function apiRequest(method: string, path: string, body?: any) {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    return response.json();
  }

  async function cleanupSite(siteId: string) {
    try {
      await apiRequest('DELETE', `/sites/${siteId}`);
      console.log(`Deleted test site: ${siteId}`);
    } catch (e) {
      console.log(`Failed to delete site ${siteId}:`, e);
    }
  }

  console.log('Global teardown complete');
}