'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { BottomNavigation } from './BottomNavigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';

const OBSERVER_BLOCKED_PATHS = ['/check-in', '/coach/dashboard', '/coach/capture'];

type MainLayoutProps = { children?: ReactNode };
export function MainLayout({ children }: MainLayoutProps = {}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse } = useSidebar();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Observer: block access to Coach module
  useEffect(() => {
    if (user?.role === 'observer' && pathname) {
      const isBlocked = OBSERVER_BLOCKED_PATHS.some(
        (p) => pathname === p || pathname.startsWith(p + '/')
      );
      if (isBlocked) {
        router.replace('/command-center');
      }
    }
  }, [user?.role, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Coach layout: Mobile Webview style with bottom navigation (never for observer)
  if (user?.role === 'coach') {
    return (
      <div className="min-h-screen bg-slate-50 pb-16">
        <main className="w-full overflow-auto">
          {children}
        </main>
        <BottomNavigation />
      </div>
    );
  }

  // Desktop layout: Sidebar for team_lead and team_member
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}


