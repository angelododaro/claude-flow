import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { ApiService } from '../services/api';

interface User {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionAdd: (userId: string) => void;
  onMentionRemove: (userId: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const MentionInput = forwardRef<HTMLTextAreaElement, MentionInputProps>(({
  value,
  onChange,
  onMentionAdd,
  onMentionRemove,
  placeholder,
  className,
  onFocus,
  onBlur,
  onKeyDown
}, ref) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load users for mentions (you might want to cache this)
  useEffect(() => {
    // This would typically load users from your API
    // For now, we'll use a mock implementation
    const loadUsers = async () => {
      try {
        // const response = await ApiService.getUsers();
        // setUsers(response);
        
        // Mock users for demonstration
        setUsers([
          { id: '1', username: 'alice', full_name: 'Alice Smith' },
          { id: '2', username: 'bob', full_name: 'Bob Johnson' },
          { id: '3', username: 'charlie', full_name: 'Charlie Brown' }
        ]);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    loadUsers();
  }, []);

  const detectMention = (text: string, cursorPos: number) => {
    const beforeCursor = text.substring(0, cursorPos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      const start = beforeCursor.lastIndexOf('@');
      return { query, start };
    }
    
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    
    // Check for mention
    const mention = detectMention(newValue, cursorPos);
    
    if (mention) {
      setMentionQuery(mention.query);
      setMentionStart(mention.start);
      
      // Filter users based on query
      const filtered = users.filter(user =>
        user.username.toLowerCase().includes(mention.query.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(mention.query.toLowerCase()))
      );
      
      setFilteredUsers(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
    }
  };

  const insertMention = (user: User) => {
    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(mentionStart + mentionQuery.length + 1); // +1 for @
    const newValue = `${beforeMention}@${user.username} ${afterMention}`;
    
    onChange(newValue);
    onMentionAdd(user.id);
    setShowSuggestions(false);
    
    // Focus back to textarea
    if (ref && 'current' in ref && ref.current) {
      const newCursorPos = beforeMention.length + user.username.length + 2; // +2 for @ and space
      setTimeout(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          if (filteredUsers[selectedIndex]) {
            e.preventDefault();
            insertMention(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          break;
        default:
          break;
      }
    }
    
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
      />
      
      {/* Mention suggestions */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-64 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          style={{
            top: '100%',
            left: '0'
          }}
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertMention(user)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user.full_name || user.username}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  @{user.username}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});