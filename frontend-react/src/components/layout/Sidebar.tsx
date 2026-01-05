'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
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

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className={cn(
      'bg-gray-50 min-h-screen border-r border-gray-200 flex flex-col transition-all duration-300',
      isCollapsed ? 'w-20' : 'w-64'
    )}>
      {/* Logo and Toggle */}
      <div className="p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="text-center">
            <button
              onClick={onToggleCollapse}
              className="cursor-pointer hover:opacity-80 transition-opacity mb-2"
              title="Collapse sidebar"
            >
              <div className="text-4xl">⚽</div>
            </button>
            <h1 className="text-lg font-bold text-gray-900">TOFA Academy CRM</h1>
          </div>
        )}
        {isCollapsed && (
          <div className="text-center w-full">
            <button
              onClick={onToggleCollapse}
              className="cursor-pointer hover:opacity-80 transition-opacity mx-auto"
              title="Expand sidebar"
            >
              <div className="text-3xl">⚽</div>
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
                  ? 'bg-gradient-primary text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
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

