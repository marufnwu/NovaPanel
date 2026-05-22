import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockContainer = {
  id: 'c1',
  projectId: 'p1',
  name: 'test-container',
  type: 'image' as const,
  composeFile: null,
  dockerfile: null,
  image: 'nginx:alpine',
  containerId: null,
  env: '{}',
  secrets: '[]',
  networkMode: 'bridge',
  exposedPorts: '[]',
  cpuLimit: null,
  memoryLimit: null,
  replicas: 1,
  status: 'stopped',
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('../../db/index', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
        orderBy: vi.fn(() => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 'test-id', name: 'test-container' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => []),
    })),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../services/executor', () => ({
  run: vi.fn(() => Promise.resolve({ stdout: 'container-id-123', stderr: '', success: true })),
}));

vi.mock('../audit/audit.service', () => ({
  auditService: { log: vi.fn(() => Promise.resolve()) },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'test-nanoid-id',
}));

describe('Containers Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have a working test setup', () => {
    expect(true).toBe(true);
  });
});