import { Navigate } from '@tanstack/react-router';
import { useAuthStore } from '../../store/auth.store';
import { AppLayout } from '../layout/AppLayout';

export function AuthGuard() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <AppLayout />;
}
