import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MentionText } from './MentionText';

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

interface CommentItemProps {
  comment: Comment;
  onUpdate: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string, reactionType?: string) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
  onReply?: () => void;
  depth: number;
  showReplyButton?: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onUpdate,
  onDelete,
  onLike,
  onResolve,
  onReply,
  depth,
  showReplyButton = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    try {
      // This would call the API to update the comment
      // For now, just update locally
      const updatedComment = {
        ...comment,
        content: editContent,
        edited_at: new Date().toISOString()
      };
      onUpdate(updatedComment);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      onDelete(comment.id);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setIsDeleting(false);
    }
  };

  const handleLike = () => {
    onLike(comment.id, 'like');
  };

  const handleResolve = () => {
    onResolve(comment.id, !comment.is_resolved);
  };

  const getCommentTypeIcon = () => {
    switch (comment.comment_type) {
      case 'question':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'suggestion':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      case 'annotation':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      case 'approval':
        return (
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  if (isDeleting) {
    return (
      <div className="comment-item bg-gray-50 border border-gray-200 rounded-lg p-3 opacity-50">
        <div className="flex items-center space-x-2 text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
          <span className="text-sm">Deleting comment...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`comment-item bg-white border border-gray-200 rounded-lg p-3 transition-all duration-200 ${
        comment.is_resolved ? 'bg-green-50 border-green-200' : ''
      } ${comment.is_pinned ? 'bg-yellow-50 border-yellow-200' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {comment.author.avatar_url ? (
              <img
                src={comment.author.avatar_url}
                alt={comment.author.username}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">
                  {comment.author.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Author info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 truncate">
                {comment.author.full_name || comment.author.username}
              </span>
              <span className="text-xs text-gray-500">@{comment.author.username}</span>
              {getCommentTypeIcon()}
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>{formatTimeAgo(comment.created_at)}</span>
              {comment.edited_at && (
                <span className="text-gray-400">(edited {formatTimeAgo(comment.edited_at)})</span>
              )}
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center space-x-1">
            {comment.is_pinned && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Pinned
              </span>
            )}
            {comment.is_resolved && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Resolved
              </span>
            )}
            {comment.is_private && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Private
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              placeholder="Edit your comment..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={!editContent.trim()}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-900 leading-relaxed">
            {comment.content_type === 'markdown' ? (
              <MarkdownRenderer content={comment.content} />
            ) : (
              <MentionText 
                content={comment.content} 
                mentionedUsers={comment.mentioned_users || []} 
              />
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`flex items-center justify-between transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-60'}`}>
        <div className="flex items-center space-x-4">
          {/* Like button */}
          <button
            onClick={handleLike}
            className={`flex items-center space-x-1 text-xs transition-colors ${
              comment.user_liked 
                ? 'text-red-600 hover:text-red-700' 
                : 'text-gray-500 hover:text-red-600'
            }`}
          >
            <svg 
              className={`w-4 h-4 ${comment.user_liked ? 'fill-current' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
              />
            </svg>
            <span>{comment.likes_count || 0}</span>
          </button>

          {/* Reply button */}
          {showReplyButton && onReply && (
            <button
              onClick={onReply}
              className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Reply</span>
            </button>
          )}

          {/* Replies count */}
          {comment.replies_count > 0 && (
            <span className="text-xs text-gray-500">
              {comment.replies_count} {comment.replies_count === 1 ? 'reply' : 'replies'}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {!comment.is_resolved && (
            <button
              onClick={handleResolve}
              className="p-1 text-gray-400 hover:text-green-600 rounded transition-colors"
              title="Mark as resolved"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}

          {comment.is_resolved && (
            <button
              onClick={handleResolve}
              className="p-1 text-gray-400 hover:text-yellow-600 rounded transition-colors"
              title="Mark as unresolved"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </button>
          )}

          <button
            onClick={handleEdit}
            className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
            title="Edit comment"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
            title="Delete comment"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};