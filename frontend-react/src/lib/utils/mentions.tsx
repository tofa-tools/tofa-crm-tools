/**
 * Mention parsing and rendering utilities
 */
import React from 'react';

export function parseMentions(text: string): string[] {
  // Match @username pattern (alphanumeric + underscore)
  const pattern = /@(\w+)/g;
  const matches = Array.from(text.matchAll(pattern));
  const usernames = matches.map(match => match[1]);
  // Remove duplicates while preserving order
  const seen = new Set<string>();
  return usernames.filter(username => {
    const lower = username.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

export function highlightMentions(text: string, users: Array<{ id: number; email: string; full_name: string }>): React.ReactNode {
  // Create a map of username -> user for quick lookup
  const userMap = new Map<string, { id: number; email: string; full_name: string }>();
  users.forEach(user => {
    // Map by email (without domain for simplicity)
    const emailPrefix = user.email.split('@')[0].toLowerCase();
    userMap.set(emailPrefix, user);
    // Map by full_name (lowercase, spaces removed)
    const nameKey = user.full_name.toLowerCase().replace(/\s+/g, '');
    userMap.set(nameKey, user);
    // Also map by full_name with spaces
    const nameKeyWithSpaces = user.full_name.toLowerCase();
    userMap.set(nameKeyWithSpaces, user);
  });

  // Split text by mentions
  const parts: Array<string | { type: 'mention'; username: string; user?: { id: number; email: string; full_name: string } }> = [];
  const pattern = /@(\w+(?:\s+\w+)*)/g; // Match @username or @full name
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add mention
    const username = match[1].toLowerCase();
    const user = userMap.get(username) || userMap.get(username.replace(/\s+/g, ''));
    parts.push({
      type: 'mention',
      username: match[1],
      user,
    });
    
    lastIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Render parts
  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index}>{part}</span>;
        } else {
          return (
            <span
              key={index}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-sm font-medium"
              title={part.user ? `@${part.user.email}` : `@${part.username}`}
            >
              @{part.user?.full_name || part.username}
            </span>
          );
        }
      })}
    </>
  );
}

