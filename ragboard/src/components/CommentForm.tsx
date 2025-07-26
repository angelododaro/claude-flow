import React, { useState, useRef, useEffect } from 'react';
import { ApiService } from '../services/api';
import { MentionInput } from './MentionInput';

interface Comment {
  id: string;
  content: string;
  content_type: string;
  comment_type: string;
  status: string;
  parent_id?: string;
  thread_id?: string;
  depth: number;
  board_id?: string;
  resource_id?: string;
  frame_id?: string;
  card_id?: string;
  position_x?: number;
  position_y?: number;
  mentioned_users?: string[];
  is_pinned: boolean;
  is_resolved: boolean;
  is_private: boolean;
  likes_count: number;
  replies_count: number;
  author_id: string;
  resolved_by_id?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  edited_at?: string;
  author: {
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
  replies?: Comment[];
  likes?: any[];
  user_liked?: boolean;
}

interface CommentFormProps {
  boardId?: string;
  resourceId?: string;
  frameId?: string;
  cardId?: string;
  parentId?: string;
  position?: { x: number; y: number };
  onCommentCreated: (comment: Comment) => void;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  boardId,
  resourceId,
  frameId,
  cardId,
  parentId,
  position,
  onCommentCreated,
  placeholder = "Add a comment...",
  compact = false,
  autoFocus = false,
  onCancel
}) => {
  const [content, setContent] = useState('');
  const [commentType, setCommentType] = useState<'general' | 'question' | 'suggestion' | 'annotation' | 'approval'>('general');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const commentData = {
        content: content.trim(),
        content_type: 'markdown',
        comment_type: commentType,
        board_id: boardId,
        resource_id: resourceId,
        frame_id: frameId,
        card_id: cardId,
        parent_id: parentId,
        position_x: position?.x,
        position_y: position?.y,
        mentioned_users: mentionedUsers,
        is_private: isPrivate
      };

      const newComment = await ApiService.createComment(commentData);
      onCommentCreated(newComment);
      
      // Reset form
      setContent('');
      setCommentType('general');
      setIsPrivate(false);
      setMentionedUsers([]);
      setShowTypeSelector(false);
      setIsFocused(false);
    } catch (error) {
      console.error('Error creating comment:', error);
      // TODO: Show error toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setContent('');
    setCommentType('general');
    setIsPrivate(false);
    setMentionedUsers([]);
    setShowTypeSelector(false);
    setIsFocused(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as any);
    }
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      handleCancel();
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [content]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'question':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'suggestion':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'annotation':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      case 'approval':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
    }
  };

  const isExpanded = isFocused || content.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="comment-form">
      <div className={`border border-gray-300 rounded-lg transition-all duration-200 ${isFocused ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}>
        {/* Main textarea */}
        <div className="relative">
          <MentionInput
            ref={textareaRef}
            value={content}
            onChange={setContent}
            onMentionAdd={(userId) => setMentionedUsers(prev => [...prev, userId])}
            onMentionRemove={(userId) => setMentionedUsers(prev => prev.filter(id => id !== userId))}
            placeholder={placeholder}
            className={`w-full p-3 text-sm border-none rounded-lg resize-none focus:outline-none ${compact ? 'min-h-[60px]' : 'min-h-[80px]'} max-h-48`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 100)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Expanded controls */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-3 bg-gray-50 rounded-b-lg">
            {/* Type selector */}
            {!compact && (
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                  Comment Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['general', 'question', 'suggestion', 'annotation', 'approval'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCommentType(type)}
                      className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                        commentType === type
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {getTypeIcon(type)}
                      <span className="capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Additional options */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Private toggle */}
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Private</span>
                </label>

                {/* Mentioned users count */}
                {mentionedUsers.length > 0 && (
                  <span className="text-xs text-blue-600">
                    {mentionedUsers.length} user{mentionedUsers.length !== 1 ? 's' : ''} mentioned
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2">
                {onCancel && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!content.trim() || isSubmitting}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      <span>Posting...</span>
                    </div>
                  ) : (
                    parentId ? 'Reply' : 'Comment'
                  )}
                </button>
              </div>
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="mt-2 text-xs text-gray-500">
              {!compact && <span>⌘+Enter to post • </span>}Supports @mentions and markdown
            </div>
          </div>
        )}
      </div>
    </form>
  );
};