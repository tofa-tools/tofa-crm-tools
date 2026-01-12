'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { approvalsAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  // Check-In for coaches (first item for them)
  { label: 'Check-In', href: '/check-in', icon: '✅', roles: ['coach'] },
  { label: 'Command Center', href: '/command-center', icon: '🚀' },
  { label: 'My Leads', href: '/leads', icon: '👥' },
  {
    label: 'Batches',
    href: '/batches',
    icon: '📅',
    roles: ['team_lead'],
  },
  {
    label: 'Manage Centers',
    href: '/centers',
    icon: '🏢',
    roles: ['team_lead'],
  },
  {
    label: 'Manage Users',
    href: '/users',
    icon: '👤',
    roles: ['team_lead'],
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: '⚖️',
    roles: ['team_lead'],
  },
  {
    label: 'Import Data',
    href: '/import',
    icon: '📊',
    roles: ['team_lead'],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Fetch pending approvals count (team leads only)
  const { data: pendingApprovalsData } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsAPI.getPendingRequests(),
    enabled: user?.role === 'team_lead',
    refetchInterval: 60000, // Refetch every minute
  });

  const pendingApprovalsCount = pendingApprovalsData?.count || 0;

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className={cn(
      'bg-gray-50 min-h-screen border-r border-gray-200 flex flex-col transition-all duration-300',
      isCollapsed ? 'w-20' : 'w-64'
    )}>
      {/* Logo and Toggle */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-tofa-navy to-indigo-950">
        {!isCollapsed && (
          <div className="text-center">
            <Link
              href="/command-center"
              className="block cursor-pointer hover:opacity-90 transition-opacity mb-3"
            >
              <div className="flex justify-center mb-2">
                <Image
                  src="/logo.png"
                  alt="TOFA Logo"
                  width={80}
                  height={80}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <button
              onClick={onToggleCollapse}
              className="text-xs text-white/70 hover:text-white transition-colors uppercase tracking-wider font-semibold"
              title="Collapse sidebar"
            >
              ← Collapse
            </button>
          </div>
        )}
        {isCollapsed && (
          <div className="text-center w-full">
            <Link
              href="/command-center"
              className="block cursor-pointer hover:opacity-90 transition-opacity mb-3"
            >
              <div className="flex justify-center">
                <Image
                  src="/logo.png"
                  alt="TOFA Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <button
              onClick={onToggleCollapse}
              className="text-xs text-white/70 hover:text-white transition-colors"
              title="Expand sidebar"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold">
              {user?.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      )}
      {isCollapsed && (
        <div className="p-4 border-b border-gray-200 flex justify-center">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold">
            {user?.email.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg transition-colors relative group',
                isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3',
                isActive
                  ? 'bg-gradient-to-r from-tofa-gold/90 to-amber-600 text-tofa-navy shadow-md font-bold'
                  : 'text-gray-700 hover:bg-tofa-gold/10 hover:text-tofa-navy'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && (
                <span className="font-medium flex-1">{item.label}</span>
              )}
              {/* Badge for Approvals */}
              {item.href === '/approvals' && pendingApprovalsCount > 0 && (
                <span className={cn(
                  'px-2 py-0.5 text-xs font-bold rounded-full',
                  isActive ? 'bg-white/20 text-white' : 'bg-yellow-500 text-white'
                )}>
                  {pendingApprovalsCount}
                </span>
              )}
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <span className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={logout}
          className={cn(
            'w-full flex items-center rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium relative group',
            isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3 gap-3'
          )}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <span className="text-xl">🚪</span>
          {!isCollapsed && <span>Logout</span>}
          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <span className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

