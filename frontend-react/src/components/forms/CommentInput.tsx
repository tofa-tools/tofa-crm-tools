'use client';

import { useState, useRef, useEffect } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { parseMentions } from '@/lib/utils/mentions';

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

export function CommentInput({ value, onChange, placeholder = 'Add a comment...', onSubmit }: CommentInputProps) {
  const { data: users = [] } = useUsers();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Filter users for mention autocomplete
  const filteredUsers = users.filter(user => {
    if (!mentionQuery) return false;
    const query = mentionQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.full_name.toLowerCase().includes(query)
    );
  }).slice(0, 5); // Limit to 5 suggestions

  // Detect @ trigger and show autocomplete
  useEffect(() => {
    if (!textareaRef.current) return;

    const handleInput = (e: Event) => {
      const target = e.target as HTMLTextAreaElement;
      const cursorPos = target.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      
      // Check if we're in a mention (@username)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // Check if there's a space after @ (not a mention)
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionQuery(textAfterAt);
          setShowMentions(true);
          setCursorPosition(cursorPos);
          return;
        }
      }
      setShowMentions(false);
    };

    const textarea = textareaRef.current;
    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keyup', handleInput);
    textarea.addEventListener('click', handleInput);

    return () => {
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('keyup', handleInput);
      textarea.removeEventListener('click', handleInput);
    };
  }, [value]);

  const insertMention = (user: { email: string; full_name: string }) => {
    if (!textareaRef.current) return;
    
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    // Replace @query with @username
    const newText = 
      textBeforeCursor.substring(0, lastAtIndex) +
      `@${user.full_name} ` +
      textAfterCursor;
    
    onChange(newText);
    setShowMentions(false);
    
    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = lastAtIndex + user.full_name.length + 2; // +2 for @ and space
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        // Simple implementation - just select first user on Enter
        if (e.key === 'Enter' && filteredUsers.length > 0) {
          insertMention(filteredUsers[0]);
        }
      }
    }
    
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
        rows={3}
      />
      
      {/* Mention Autocomplete Dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertMention(user)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            >
              <div className="font-medium text-gray-900">{user.full_name}</div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </button>
          ))}
        </div>
      )}
      
      {/* Hint text */}
      <p className="mt-1 text-xs text-gray-500">
        Type @ to mention a team member. Press Ctrl+Enter to submit.
      </p>
    </div>
  );
}

