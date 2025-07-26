import React, { useState } from 'react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

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

interface CommentThreadProps {
  comments: Comment[];
  onCommentUpdated: (comment: Comment) => void;
  onCommentDeleted: (commentId: string) => void;
  onCommentLiked: (commentId: string, reactionType?: string) => void;
  onCommentResolved: (commentId: string, resolved: boolean) => void;
  onReplyCreated: (comment: Comment) => void;
  boardId?: string;
  resourceId?: string;
  frameId?: string;
  cardId?: string;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comments,
  onCommentUpdated,
  onCommentDeleted,
  onCommentLiked,
  onCommentResolved,
  onReplyCreated,
  boardId,
  resourceId,
  frameId,
  cardId
}) => {
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [showingReplyForm, setShowingReplyForm] = useState<string | null>(null);

  const toggleExpanded = (commentId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedComments(newExpanded);
  };

  const handleReplyClick = (commentId: string) => {
    setShowingReplyForm(showingReplyForm === commentId ? null : commentId);
  };

  const handleReplyCreated = (newComment: Comment) => {
    onReplyCreated(newComment);
    setShowingReplyForm(null);
  };

  // Sort comments by creation date and build a tree structure
  const sortedComments = [...comments].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Build a tree structure for nested comments
  const buildCommentTree = (comments: Comment[], parentId: string | null = null): Comment[] => {
    return comments
      .filter(comment => comment.parent_id === parentId)
      .map(comment => ({
        ...comment,
        replies: buildCommentTree(comments, comment.id)
      }));
  };

  // Get all replies for a comment including nested ones
  const getAllReplies = (commentId: string): Comment[] => {
    const allComments = [...comments];
    const replies: Comment[] = [];
    
    const findReplies = (parentId: string) => {
      const directReplies = allComments.filter(c => c.parent_id === parentId);
      directReplies.forEach(reply => {
        replies.push(reply);
        findReplies(reply.id); // Recursively find nested replies
      });
    };
    
    findReplies(commentId);
    return replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isExpanded = expandedComments.has(comment.id);
    const isShowingReplyForm = showingReplyForm === comment.id;
    const replies = getAllReplies(comment.id);
    const hasReplies = replies.length > 0;

    return (
      <div key={comment.id} className="comment-thread-item">
        <CommentItem
          comment={comment}
          onUpdate={onCommentUpdated}
          onDelete={onCommentDeleted}
          onLike={onCommentLiked}
          onResolve={onCommentResolved}
          onReply={() => handleReplyClick(comment.id)}
          depth={depth}
          showReplyButton={true}
        />

        {/* Reply Form */}
        {isShowingReplyForm && (
          <div className={`mt-2 ${depth > 0 ? 'ml-8' : 'ml-12'}`}>
            <CommentForm
              boardId={boardId}
              resourceId={resourceId}
              frameId={frameId}
              cardId={cardId}
              parentId={comment.id}
              onCommentCreated={handleReplyCreated}
              placeholder={`Reply to ${comment.author.username}...`}
              compact={true}
              autoFocus={true}
              onCancel={() => setShowingReplyForm(null)}
            />
          </div>
        )}

        {/* Replies */}
        {hasReplies && (
          <div className={`mt-2 ${depth > 0 ? 'ml-4' : 'ml-8'}`}>
            {/* Toggle replies button */}
            <button
              onClick={() => toggleExpanded(comment.id)}
              className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 mb-2 px-2 py-1 rounded hover:bg-gray-50"
            >
              <svg
                className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>
                {isExpanded ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            </button>

            {/* Render replies */}
            {isExpanded && (
              <div className="space-y-3 border-l-2 border-gray-100 pl-3">
                {replies.map(reply => renderComment(reply, depth + 1))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Get root comments (those without a parent_id)
  const rootComments = sortedComments.filter(comment => !comment.parent_id);

  return (
    <div className="comment-thread space-y-4">
      {rootComments.map(comment => renderComment(comment, 0))}
    </div>
  );
};