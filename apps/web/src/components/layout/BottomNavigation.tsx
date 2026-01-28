'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, CheckSquare, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface BottomNavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: (e?: React.MouseEvent) => void;
  isButton?: boolean;
}

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  // Handle attendance navigation with batchId from localStorage
  const handleAttendanceClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (typeof window !== 'undefined') {
      const lastBatchId = localStorage.getItem('lastSelectedBatchId');
      if (lastBatchId) {
        router.push(`/check-in?batchId=${lastBatchId}`);
      } else {
        router.push('/check-in');
      }
    }
  };

  // Coach-specific navigation
  const navItems: BottomNavItem[] = [
    { label: 'Sessions', href: '/coach/dashboard', icon: LayoutDashboard },
    { 
      label: 'Attendance', 
      href: '/check-in',
      icon: CheckSquare,
      onClick: handleAttendanceClick,
    },
    { label: 'Player Skills', href: '/coach/players', icon: Users },
    { 
      label: 'Logout', 
      icon: LogOut, 
      onClick: logout,
      isButton: true
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t-4 border-indigo-200 shadow-2xl z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-20 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + '/'));
          
          if (item.isButton) {
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative group',
                  'text-gray-500 hover:text-red-600 active:scale-90'
                )}
              >
                <Icon className="h-7 w-7 mb-1 transition-all duration-200" />
                <span className="text-xs font-black uppercase tracking-wide">{item.label}</span>
              </button>
            );
          }
          
          // Handle items with custom onClick (like Attendance)
          if (item.onClick) {
            return (
              <button
                key={item.href}
                onClick={item.onClick}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative group',
                  isActive
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-indigo-500'
                )}
              >
                <Icon className={cn(
                  'mb-1 transition-all duration-200',
                  isActive ? 'h-8 w-8' : 'h-6 w-6 group-hover:h-7 group-hover:w-7'
                )} />
                {isActive && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-600 rounded-full shadow-lg shadow-indigo-400 animate-pulse" />
                )}
                <span className={cn(
                  'text-xs font-black uppercase tracking-wide transition-all duration-200',
                  isActive && 'text-indigo-600'
                )}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative group',
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-500 hover:text-indigo-500'
              )}
            >
              <Icon className={cn(
                'mb-1 transition-all duration-200',
                isActive ? 'h-8 w-8' : 'h-6 w-6 group-hover:h-7 group-hover:w-7'
              )} />
              {isActive && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-600 rounded-full shadow-lg shadow-indigo-400 animate-pulse" />
              )}
              <span className={cn(
                'text-xs font-black uppercase tracking-wide transition-all duration-200',
                isActive && 'text-indigo-600'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

