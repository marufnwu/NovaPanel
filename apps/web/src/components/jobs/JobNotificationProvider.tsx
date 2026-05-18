import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../lib/toast';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface JobNotification {
  jobId: string;
  type: string;
  status: JobStatus;
  message: string;
  progress?: number;
  timestamp: string;
  timer?: ReturnType<typeof setTimeout>;
}

interface JobNotificationContextValue {
  jobs: JobNotification[];
  runningCount: number;
  dismissJob: (jobId: string) => void;
  clearAllJobs: () => void;
}

const JobNotificationContext = createContext<JobNotificationContextValue | null>(null);

const WS_URL = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/jobs`;
};

const AUTO_DISMISS_DELAY_MS = 5000;
const MAX_VISIBLE_JOBS = 10;
const INVALIDATION_DEBOUNCE_MS = 2000;

const JOB_QUERY_KEYS: Record<string, string[]> = {
  backup: ['backups'],
  schedule: ['backups'],
  'ssl-renew': ['ssl'],
  ssl: ['ssl'],
  'domain-create': ['domains'],
  domain: ['domains'],
  'website-create': ['websites'],
  website: ['websites'],
  'db-create': ['databases'],
  database: ['databases'],
  'ftp-create': ['ftp'],
  ftp: ['ftp'],
  'cron-create': ['cron'],
  cron: ['cron'],
  firewall: ['firewall'],
  mail: ['mail'],
};

const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>();

export function JobNotificationProvider({ children }: { children: ReactNode }) {
  const sessionHash = useAuthStore(s => s.sessionHash);
  const qc = useQueryClient();
  const [jobs, setJobs] = useState<JobNotification[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const dismissJob = useCallback((jobId: string) => {
    setJobs(prev => {
      const job = prev.find(j => j.jobId === jobId);
      if (job?.timer) clearTimeout(job.timer);
      return prev.filter(j => j.jobId !== jobId);
    });
  }, []);

  const clearAllJobs = useCallback(() => {
    setJobs(prev => {
      prev.forEach(j => { if (j.timer) clearTimeout(j.timer); });
      return [];
    });
  }, []);

  const invalidateForJob = useCallback((type: string, status: 'done' | 'failed') => {
    const keys = JOB_QUERY_KEYS[type];
    if (!keys) return;

    keys.forEach(key => {
      const existing = pendingInvalidations.get(key);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        pendingInvalidations.delete(key);
        qc.invalidateQueries({ queryKey: [key] });
        if (status === 'done') {
          toast.success(`${type} completed — refreshing data`);
        } else {
          toast.error(`${type} failed — check details`);
        }
      }, INVALIDATION_DEBOUNCE_MS);

      pendingInvalidations.set(key, timer);
    });

    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  useEffect(() => {
    if (!sessionHash) return;

    let socket: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 5;

    function connect() {
      socket = new WebSocket(`${WS_URL()}?sessionHash=${encodeURIComponent(sessionHash ?? '')}`);
      setWs(socket);

      socket.onopen = () => { reconnectAttempts = 0; };
      socket.onclose = () => {
        setWs(null);
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          reconnectTimer = setTimeout(connect, delay);
        }
      };
      socket.onerror = () => {};

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected' || data.type === 'pong') return;

          if (data.status === 'done' || data.status === 'failed') {
            invalidateForJob(data.type, data.status);
          }

          const job: JobNotification = {
            jobId: data.jobId,
            type: data.type,
            status: data.status,
            message: data.message,
            progress: data.progress,
            timestamp: data.timestamp,
          };

          if (data.status === 'done') {
            job.timer = setTimeout(() => dismissJob(data.jobId), AUTO_DISMISS_DELAY_MS);
          }

          setJobs(prev => {
            const filtered = prev.filter(j => j.jobId !== data.jobId);
            return [job, ...filtered].slice(0, MAX_VISIBLE_JOBS);
          });

          if (data.status === 'queued') {
            toast.info(`Job queued: ${data.message}`);
          } else if (data.status === 'done') {
            toast.success(data.message);
          } else if (data.status === 'failed') {
            toast.error(data.message);
          }
        } catch {}
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      pendingInvalidations.forEach(t => clearTimeout(t));
      pendingInvalidations.clear();
      if (socket) { socket.onclose = null; socket.close(); }
      setWs(null);
    };
  }, [sessionHash, dismissJob, invalidateForJob]);

  const runningCount = jobs.filter(j => j.status === 'queued' || j.status === 'running').length;

  return (
    <JobNotificationContext.Provider value={{ jobs, runningCount, dismissJob, clearAllJobs }}>
      {children}
    </JobNotificationContext.Provider>
  );
}

export function useJobNotifications() {
  const ctx = useContext(JobNotificationContext);
  if (!ctx) throw new Error('useJobNotifications must be used within JobNotificationProvider');
  return ctx;
}