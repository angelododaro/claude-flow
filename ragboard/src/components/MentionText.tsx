import React from 'react';

interface MentionTextProps {
  content: string;
  mentionedUsers: string[];
  className?: string;
}

export const MentionText: React.FC<MentionTextProps> = ({ 
  content, 
  mentionedUsers = [], 
  className = '' 
}) => {
  // Parse mentions in text and make them clickable
  const parseMentions = (text: string): React.ReactNode => {
    if (!text) return text;

    // Split by @mentions
    const parts = text.split(/(@\w+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1); // Remove @
        return (
          <span
            key={index}
            className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer"
            onClick={() => {
              // Handle mention click - could open user profile, etc.
              console.log('Clicked mention:', username);
            }}
            title={`Mentioned user: ${username}`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <span className={`mention-text ${className}`}>
      {parseMentions(content)}
    </span>
  );
};