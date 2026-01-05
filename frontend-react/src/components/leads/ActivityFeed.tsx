'use client';

import { useLeadActivity } from '@/hooks/useLeadActivity';
import { useLeads } from '@/hooks/useLeads';
import { formatDateTime } from '@/lib/utils';
import { highlightMentions } from '@/lib/utils/mentions';
import { useUsers } from '@/hooks/useUsers';
import type { AuditLog, Comment } from '@/types';
import { useMemo } from 'react';

interface ActivityFeedProps {
  leadId: number;
  comments?: Comment[];
}

export function ActivityFeed({ leadId, comments = [] }: ActivityFeedProps) {
  const { data: auditLogs = [], isLoading } = useLeadActivity(leadId, 50);
  const { data: users = [] } = useUsers();
  
  // Combine audit logs and comments into a single timeline
  const timeline = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'audit' | 'comment';
      timestamp: string;
      description: string | JSX.Element;
      user?: { id: number; name: string; email?: string };
      icon: string;
      color: string;
      oldValue?: string | null;
      newValue?: string | null;
      isComment?: boolean;
    }> = [];

    // Add audit logs
    auditLogs.forEach((log) => {
      let description: string | JSX.Element = log.description || '';
      
      // If it's a comment_added action, highlight mentions in the comment text
      if (log.action_type === 'comment_added' && log.new_value) {
        description = highlightMentions(log.new_value, users);
      }
      
      items.push({
        id: `audit-${log.id}`,
        type: 'audit',
        timestamp: log.timestamp,
        description,
        user: log.user ? { id: log.user.id, name: log.user.full_name, email: log.user.email } : undefined,
        icon: getActionIcon(log.action_type),
        color: getActionColor(log.action_type),
        oldValue: log.old_value,
        newValue: log.new_value,
        isComment: log.action_type === 'comment_added',
      });
    });

    // Add comments
    comments.forEach((comment) => {
      items.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        timestamp: comment.timestamp,
        description: comment.text,
        user: undefined, // Comment will have user_id, but we'd need to fetch user details
        icon: '💬',
        color: 'bg-blue-100 border-blue-300',
      });
    });

    // Sort by timestamp (newest first)
    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [auditLogs, comments]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading activity...</p>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Activity Feed</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-6">
          {timeline.map((item, index) => (
            <div key={item.id} className="relative flex gap-4">
              {/* Icon/Connector */}
              <div className="relative z-10 flex-shrink-0">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${item.color}`}>
                  <span className="text-sm">{item.icon}</span>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 pb-6">
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      {typeof item.description === 'string' ? (
                        <p className="text-sm font-medium text-gray-900">
                          {item.description}
                        </p>
                      ) : (
                        <div className="text-sm font-medium text-gray-900">
                          {item.isComment && <span className="text-gray-600">Added comment: &quot;</span>}
                          <span className={item.isComment ? 'italic' : ''}>
                            {item.description}
                          </span>
                          {item.isComment && <span className="text-gray-600">&quot;</span>}
                        </div>
                      )}
                      {item.user && (
                        <p className="text-xs text-gray-500 mt-1">
                          by {item.user.name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                      {formatDateTime(item.timestamp)}
                    </span>
                  </div>
                  
                  {/* Show value changes for audit logs */}
                  {item.type === 'audit' && (item.oldValue !== undefined || item.newValue !== undefined) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                      {item.oldValue && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-500">From:</span>
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
                            {item.oldValue}
                          </span>
                        </div>
                      )}
                      {item.newValue && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">To:</span>
                          <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                            {item.newValue}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getActionIcon(actionType: string): string {
  switch (actionType) {
    case 'status_change':
      return '🔄';
    case 'comment_added':
      return '💬';
    case 'assignment_change':
      return '👤';
    case 'field_update':
      return '✏️';
    default:
      return '📝';
  }
}

function getActionColor(actionType: string): string {
  switch (actionType) {
    case 'status_change':
      return 'bg-purple-100 border-purple-300';
    case 'comment_added':
      return 'bg-blue-100 border-blue-300';
    case 'assignment_change':
      return 'bg-yellow-100 border-yellow-300';
    case 'field_update':
      return 'bg-green-100 border-green-300';
    default:
      return 'bg-gray-100 border-gray-300';
  }
}

