const API_BASE = process.env.API_BASE_URL || 'http://192.168.0.212:8732';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

class ApiClient {
  private baseUrl: string;
  private sessionHash: string | null = null;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  setSessionHash(hash: string) {
    this.sessionHash = hash;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionHash) {
      headers['Cookie'] = `sf_session=${this.sessionHash}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });

    return response.json();
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, data);
  }

  async put<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, data);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }
}

export const apiClient = new ApiClient();

export async function login(
  username: string,
  password: string
): Promise<{ sessionHash: string; user: any }> {
  const client = new ApiClient();
  const response = await client.post<{
    sessionHash: string;
    user: any;
    organizations: any[];
  }>('/auth/login', { username, password });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Login failed');
  }

  client.setSessionHash(response.data.sessionHash);
  return {
    sessionHash: response.data.sessionHash,
    user: response.data.user,
  };
}

export async function createSite(data: {
  name: string;
  primaryDomain: string;
  runtime: {
    schemaVersion: number;
    runtime: string;
    version?: string;
  };
}): Promise<{ id: string; name: string }> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  const response = await client.post<{ id: string; name: string }>('/sites', data);
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create site');
  }
  return response.data!;
}

export async function deleteSite(siteId: string): Promise<void> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  await client.delete(`/sites/${siteId}`);
}

export async function createDomain(name: string): Promise<{ id: string; name: string }> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  const response = await client.post<{ id: string; name: string }>('/domains', { name });
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create domain');
  }
  return response.data!;
}

export async function createDatabase(
  projectId: string,
  name: string,
  type: 'mariadb' | 'postgresql'
): Promise<{ id: string; name: string }> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  const response = await client.post<{ id: string; name: string }>('/databases', {
    projectId,
    name,
    type,
  });
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create database');
  }
  return response.data!;
}

export async function deleteDatabase(databaseId: string): Promise<void> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  await client.delete(`/databases/${databaseId}`);
}

export async function createCronJob(
  siteId: string,
  schedule: string,
  command: string
): Promise<{ id: string; schedule: string }> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  const response = await client.post<{ id: string; schedule: string; command: string }>(
    `/sites/${siteId}/cron`,
    { schedule, command }
  );
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create cron job');
  }
  return response.data!;
}

export async function deleteCronJob(cronJobId: string): Promise<void> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  await client.delete(`/cron/${cronJobId}`);
}

export async function getSite(siteId: string): Promise<any> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  const response = await client.get<any>(`/sites/${siteId}`);
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to get site');
  }
  return response.data;
}

export async function getSites(): Promise<any[]> {
  const client = new ApiClient();
  const loginResult = await login('admin', '7656ea4205a1b648632549c37c2089dc');
  client.setSessionHash(loginResult.sessionHash);

  const response = await client.get<any[]>('/sites');
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to get sites');
  }
  return response.data || [];
}