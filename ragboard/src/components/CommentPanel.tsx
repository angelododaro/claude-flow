import React, { useState, useEffect, useRef } from 'react';
import { ApiService } from '../services/api';
import { CommentThread } from './CommentThread';
import { CommentForm } from './CommentForm';
import { NotificationBell } from './NotificationBell';

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

interface CommentPanelProps {
  boardId?: string;
  resourceId?: string;
  frameId?: string;
  cardId?: string;
  position?: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const CommentPanel: React.FC<CommentPanelProps> = ({
  boardId,
  resourceId,
  frameId,
  cardId,
  position,
  isOpen,
  onClose,
  className = ''
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResolvedComments, setShowResolvedComments] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_liked'>('newest');
  const [filterBy, setFilterBy] = useState<'all' | 'questions' | 'suggestions' | 'annotations'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, boardId, resourceId, frameId, cardId, showResolvedComments, sortBy, filterBy]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        limit: 50,
        skip: 0
      };

      if (boardId) params.board_id = boardId;
      if (resourceId) params.resource_id = resourceId;
      if (frameId) params.frame_id = frameId;
      if (cardId) params.card_id = cardId;
      if (!showResolvedComments) params.is_resolved = false;
      if (filterBy !== 'all') params.comment_type = filterBy;

      const response = await ApiService.getComments(params);
      let loadedComments = response.comments || [];

      // Apply sorting
      if (sortBy === 'newest') {
        loadedComments.sort((a: Comment, b: Comment) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else if (sortBy === 'oldest') {
        loadedComments.sort((a: Comment, b: Comment) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      } else if (sortBy === 'most_liked') {
        loadedComments.sort((a: Comment, b: Comment) => b.likes_count - a.likes_count);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        loadedComments = loadedComments.filter((comment: Comment) =>
          comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comment.author.username.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setComments(loadedComments);
    } catch (err) {
      setError('Failed to load comments');
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentCreated = (newComment: Comment) => {
    setComments(prev => [newComment, ...prev]);
  };

  const handleCommentUpdated = (updatedComment: Comment) => {
    setComments(prev => 
      prev.map(comment => 
        comment.id === updatedComment.id ? updatedComment : comment
      )
    );
  };

  const handleCommentDeleted = (commentId: string) => {
    setComments(prev => prev.filter(comment => comment.id !== commentId));
  };

  const handleCommentLiked = async (commentId: string, reactionType: string = 'like') => {
    try {
      const result = await ApiService.likeComment(commentId, reactionType);
      
      setComments(prev => 
        prev.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              user_liked: result.liked,
              likes_count: result.liked ? comment.likes_count + 1 : comment.likes_count - 1
            };
          }
          return comment;
        })
      );
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const handleCommentResolved = async (commentId: string, resolved: boolean) => {
    try {
      if (resolved) {
        await ApiService.resolveComment(commentId);
      } else {
        await ApiService.unresolveComment(commentId);
      }
      
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, is_resolved: resolved, resolved_at: resolved ? new Date().toISOString() : undefined }
            : comment
        )
      );
    } catch (err) {
      console.error('Error resolving comment:', err);
    }
  };

  const groupedComments = comments.reduce((groups, comment) => {
    if (comment.parent_id) {
      // This is a reply - it will be handled by the parent comment
      return groups;
    }
    
    const threadId = comment.thread_id || comment.id;
    if (!groups[threadId]) {
      groups[threadId] = [];
    }
    groups[threadId].push(comment);
    return groups;
  }, {} as Record<string, Comment[]>);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`fixed right-4 top-20 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 ${className}`}
      style={{
        maxHeight: 'calc(100vh - 100px)',
        top: position ? `${position.y}px` : '80px',
        right: position ? `calc(100vw - ${position.x + 400}px)` : '16px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Comments
          </h3>
          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
            {comments.length}
          </span>
          <NotificationBell />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Filters and Controls */}
          <div className="p-3 border-b border-gray-100 space-y-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search comments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex space-x-2">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="general">General</option>
                <option value="question">Questions</option>
                <option value="suggestion">Suggestions</option>
                <option value="annotation">Annotations</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="most_liked">Most Liked</option>
              </select>
            </div>

            {/* Toggle Controls */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResolvedComments}
                  onChange={(e) => setShowResolvedComments(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Show resolved</span>
              </label>
            </div>
          </div>

          {/* Comment Form */}
          <div className="p-3 border-b border-gray-100">
            <CommentForm
              boardId={boardId}
              resourceId={resourceId}
              frameId={frameId}
              cardId={cardId}
              position={position}
              onCommentCreated={handleCommentCreated}
              placeholder="Add a comment..."
              compact={true}
            />
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            )}

            {error && (
              <div className="p-4 text-center text-red-600 text-sm">
                {error}
                <button
                  onClick={loadComments}
                  className="block mx-auto mt-2 text-blue-600 hover:text-blue-700 underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && comments.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <svg
                  className="mx-auto w-12 h-12 text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm">No comments yet</p>
                <p className="text-xs text-gray-400 mt-1">Be the first to start a conversation</p>
              </div>
            )}

            {!loading && !error && comments.length > 0 && (
              <div className="space-y-4 p-3">
                {Object.entries(groupedComments).map(([threadId, threadComments]) => (
                  <CommentThread
                    key={threadId}
                    comments={threadComments}
                    onCommentUpdated={handleCommentUpdated}
                    onCommentDeleted={handleCommentDeleted}
                    onCommentLiked={handleCommentLiked}
                    onCommentResolved={handleCommentResolved}
                    onReplyCreated={handleCommentCreated}
                    boardId={boardId}
                    resourceId={resourceId}
                    frameId={frameId}
                    cardId={cardId}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};