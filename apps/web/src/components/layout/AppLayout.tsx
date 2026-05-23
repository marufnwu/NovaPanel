import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { StatusBar } from './StatusBar';

export function AppLayout() {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <StatusBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}