import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface ServerFeatures {
  nginx: boolean;
  apache: boolean;
  mysql: boolean;
  postgresql: boolean;
  postfix: boolean;
  ftp: boolean;
  docker: boolean;
}

export function useServerFeatures() {
  return useQuery<ServerFeatures>({
    queryKey: ['server', 'features'],
    queryFn: () => api.get<ServerFeatures>('/settings/features'),
    staleTime: 5 * 60 * 1000, // 5 minutes — features don't change often
    retry: 2,
  });
}