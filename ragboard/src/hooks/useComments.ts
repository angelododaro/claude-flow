import { useState, useEffect, useCallback } from 'react';
import { ApiService } from '../services/api';
import { useWebSocket } from './useWebSocket';

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

interface UseCommentsOptions {
  boardId?: string;
  resourceId?: string;
  frameId?: string;
  cardId?: string;
  userId?: string;
  autoLoad?: boolean;
  enableRealtime?: boolean;
}

export const useComments = ({
  boardId,
  resourceId,
  frameId,
  cardId,
  userId,
  autoLoad = true,
  enableRealtime = true
}: UseCommentsOptions = {}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const { connectionStatus, sendMessage } = useWebSocket({
    url: `ws://localhost:8000/ws/${userId}?token=${localStorage.getItem('auth_token')}`,
    onMessage: (message) => {
      handleWebSocketMessage(message);
    },
    onConnect: () => {
      // Subscribe to board/resource updates when connected
      if (boardId) {
        sendMessage({ type: 'subscribe_board', board_id: boardId });
      }
      if (resourceId) {
        sendMessage({ type: 'subscribe_resource', resource_id: resourceId });
      }
    }
  });

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'comment_created':
        const newComment = message.data;
        // Check if this comment belongs to our context
        if (
          (boardId && newComment.board_id === boardId) ||
          (resourceId && newComment.resource_id === resourceId) ||
          (frameId && newComment.frame_id === frameId) ||
          (cardId && newComment.card_id === cardId)
        ) {
          setComments(prev => [newComment, ...prev]);
        }
        break;

      case 'comment_updated':
        const updatedComment = message.data;
        setComments(prev =>
          prev.map(comment =>
            comment.id === updatedComment.id ? updatedComment : comment
          )
        );
        break;

      case 'comment_deleted':
        const deletedCommentId = message.data.comment_id;
        setComments(prev =>
          prev.filter(comment => comment.id !== deletedCommentId)
        );
        break;

      case 'comment_liked':
        const likedComment = message.data;
        setComments(prev =>
          prev.map(comment =>
            comment.id === likedComment.id
              ? {
                  ...comment,
                  likes_count: likedComment.likes_count,
                  user_liked: likedComment.user_liked
                }
              : comment
          )
        );
        break;

      default:
        break;
    }
  }, [boardId, resourceId, frameId, cardId]);

  const loadComments = useCallback(async (params?: {
    skip?: number;
    limit?: number;
    is_resolved?: boolean;
    comment_type?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams: any = {
        limit: 50,
        skip: 0,
        ...params
      };

      if (boardId) queryParams.board_id = boardId;
      if (resourceId) queryParams.resource_id = resourceId;
      if (frameId) queryParams.frame_id = frameId;
      if (cardId) queryParams.card_id = cardId;

      const response = await ApiService.getComments(queryParams);
      setComments(response.comments || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load comments');
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  }, [boardId, resourceId, frameId, cardId]);

  const createComment = useCallback(async (commentData: {
    content: string;
    content_type?: string;
    comment_type?: string;
    parent_id?: string;
    mentioned_users?: string[];
    is_private?: boolean;
    position?: { x: number; y: number };
  }) => {
    try {
      const newComment = await ApiService.createComment({
        ...commentData,
        board_id: boardId,
        resource_id: resourceId,
        frame_id: frameId,
        card_id: cardId,
        position_x: commentData.position?.x,
        position_y: commentData.position?.y
      });

      // Add to local state if not using real-time updates
      if (!enableRealtime || connectionStatus !== 'connected') {
        setComments(prev => [newComment, ...prev]);
      }

      return newComment;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create comment');
    }
  }, [boardId, resourceId, frameId, cardId, enableRealtime, connectionStatus]);

  const updateComment = useCallback(async (commentId: string, updateData: {
    content?: string;
    comment_type?: string;
    is_resolved?: boolean;
    is_pinned?: boolean;
    is_private?: boolean;
  }) => {
    try {
      const updatedComment = await ApiService.updateComment(commentId, updateData);

      // Update local state if not using real-time updates
      if (!enableRealtime || connectionStatus !== 'connected') {
        setComments(prev =>
          prev.map(comment =>
            comment.id === commentId ? updatedComment : comment
          )
        );
      }

      return updatedComment;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update comment');
    }
  }, [enableRealtime, connectionStatus]);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      await ApiService.deleteComment(commentId);

      // Update local state if not using real-time updates
      if (!enableRealtime || connectionStatus !== 'connected') {
        setComments(prev => prev.filter(comment => comment.id !== commentId));
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete comment');
    }
  }, [enableRealtime, connectionStatus]);

  const likeComment = useCallback(async (commentId: string, reactionType: string = 'like') => {
    try {
      const result = await ApiService.likeComment(commentId, reactionType);

      // Update local state if not using real-time updates
      if (!enableRealtime || connectionStatus !== 'connected') {
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
      }

      return result;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to like comment');
    }
  }, [enableRealtime, connectionStatus]);

  const resolveComment = useCallback(async (commentId: string, resolved: boolean = true) => {
    try {
      if (resolved) {
        await ApiService.resolveComment(commentId);
      } else {
        await ApiService.unresolveComment(commentId);
      }

      // Update local state if not using real-time updates
      if (!enableRealtime || connectionStatus !== 'connected') {
        setComments(prev =>
          prev.map(comment =>
            comment.id === commentId
              ? {
                  ...comment,
                  is_resolved: resolved,
                  resolved_at: resolved ? new Date().toISOString() : undefined
                }
              : comment
          )
        );
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to resolve comment');
    }
  }, [enableRealtime, connectionStatus]);

  const searchComments = useCallback(async (searchData: {
    query?: string;
    comment_type?: string;
    author_id?: string;
    is_resolved?: boolean;
    date_from?: string;
    date_to?: string;
    limit?: number;
    skip?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.searchComments({
        ...searchData,
        board_id: boardId,
        resource_id: resourceId
      });

      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to search comments');
      console.error('Error searching comments:', err);
      return { comments: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [boardId, resourceId]);

  // Send typing indicators
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (enableRealtime && connectionStatus === 'connected' && boardId) {
      sendMessage({
        type: isTyping ? 'typing_start' : 'typing_stop',
        board_id: boardId
      });
    }
  }, [enableRealtime, connectionStatus, boardId, sendMessage]);

  // Auto-load comments on mount
  useEffect(() => {
    if (autoLoad) {
      loadComments();
    }
  }, [autoLoad, loadComments]);

  return {
    comments,
    loading,
    error,
    connectionStatus,
    loadComments,
    createComment,
    updateComment,
    deleteComment,
    likeComment,
    resolveComment,
    searchComments,
    sendTypingIndicator
  };
};

export default useComments;