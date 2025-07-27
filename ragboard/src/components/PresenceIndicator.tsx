import React, { useEffect, useState } from 'react';
import wsService, { UserPresence, CursorPosition } from '../services/websocket';
import './PresenceIndicator.css';

interface PresenceIndicatorProps {
  boardId: string;
  currentUserId?: string;
}

interface CursorProps {
  cursor: CursorPosition;
  isVisible: boolean;
}

const Cursor: React.FC<CursorProps> = ({ cursor, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div
      className="remote-cursor"
      style={{
        left: cursor.x,
        top: cursor.y,
        borderColor: cursor.color,
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 1000,
        transform: 'translate(-2px, -2px)'
      }}
    >
      <div 
        className="cursor-pointer" 
        style={{ backgroundColor: cursor.color }}
      />
      <div 
        className="cursor-label"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.user_name}
      </div>
    </div>
  );
};

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ 
  boardId, 
  currentUserId 
}) => {
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map());
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [activities, setActivities] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    // Initialize presence from WebSocket service
    setPresence(wsService.getPresence());

    // Handle presence updates
    const handlePresenceJoin = (data: any) => {
      const newPresence = new Map(presence);
      newPresence.set(data.presence.user_id, data.presence);
      setPresence(newPresence);
    };

    const handlePresenceLeave = (data: any) => {
      const newPresence = new Map(presence);
      newPresence.delete(data.user_id);
      setPresence(newPresence);
      
      // Remove cursor
      const newCursors = new Map(cursors);
      newCursors.delete(data.user_id);
      setCursors(newCursors);
    };

    const handlePresenceUpdate = (data: UserPresence) => {
      const newPresence = new Map(presence);
      newPresence.set(data.user_id, data);
      setPresence(newPresence);
    };

    const handleCursorUpdate = (cursor: CursorPosition) => {
      if (cursor.user_id !== currentUserId) {
        const newCursors = new Map(cursors);
        newCursors.set(cursor.user_id, cursor);
        setCursors(newCursors);
        
        // Hide cursor after 5 seconds of inactivity
        setTimeout(() => {
          setCursors(prev => {
            const updated = new Map(prev);
            const current = updated.get(cursor.user_id);
            if (current && current.timestamp === cursor.timestamp) {
              updated.delete(cursor.user_id);
            }
            return updated;
          });
        }, 5000);
      }
    };

    const handleUserActivity = (data: any) => {
      if (data.user_id !== currentUserId) {
        const newActivities = new Map(activities);
        newActivities.set(data.user_id, data);
        setActivities(newActivities);
        
        // Clear activity after 3 seconds
        setTimeout(() => {
          setActivities(prev => {
            const updated = new Map(prev);
            const current = updated.get(data.user_id);
            if (current && current.timestamp === data.timestamp) {
              updated.delete(data.user_id);
            }
            return updated;
          });
        }, 3000);
      }
    };

    // Subscribe to events
    wsService.onPresenceJoin(handlePresenceJoin);
    wsService.onPresenceLeave(handlePresenceLeave);
    wsService.onPresenceUpdate(handlePresenceUpdate);
    wsService.onCursorUpdate(handleCursorUpdate);
    wsService.onUserActivity(handleUserActivity);

    return () => {
      // Clean up - EventEmitter doesn't support removeListener by reference
      // so we'll clear all listeners when component unmounts
      wsService.removeAllListeners('presence_join');
      wsService.removeAllListeners('presence_leave');
      wsService.removeAllListeners('presence_update');
      wsService.removeAllListeners('cursor_update');
      wsService.removeAllListeners('user_activity');
    };
  }, [boardId, currentUserId, presence, cursors, activities]);

  // Handle mouse movement to send cursor updates
  useEffect(() => {
    let throttleTimeout: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (throttleTimeout) return;
      
      throttleTimeout = window.setTimeout(() => {
        wsService.sendCursorPosition(e.clientX, e.clientY);
        throttleTimeout = null;
      }, 50); // Throttle to 20fps
    };

    const handleMouseLeave = () => {
      // Stop sending cursor updates when mouse leaves the window
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
        throttleTimeout = null;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, []);

  const activeUsers = Array.from(presence.values()).filter(
    user => user.user_id !== currentUserId
  );

  return (
    <div className="presence-indicator">
      {/* User avatars */}
      <div className="presence-avatars">
        {activeUsers.map((user) => {
          const activity = activities.get(user.user_id);
          return (
            <div
              key={user.user_id}
              className={`presence-avatar ${user.status}`}
              style={{ backgroundColor: user.color }}
              title={`${user.user_name} (${user.status})`}
            >
              <div className="avatar-initial">
                {user.user_name.charAt(0).toUpperCase()}
              </div>
              {activity && (
                <div className="activity-indicator" title={activity.activity_type}>
                  {activity.activity_type === 'typing' && '✍️'}
                  {activity.activity_type === 'editing' && '✏️'}
                  {activity.activity_type === 'selecting' && '👆'}
                </div>
              )}
            </div>
          );
        })}
        {activeUsers.length > 0 && (
          <div className="presence-count">
            {activeUsers.length} online
          </div>
        )}
      </div>

      {/* Remote cursors */}
      {Array.from(cursors.entries()).map(([userId, cursor]) => (
        <Cursor
          key={userId}
          cursor={cursor}
          isVisible={userId !== currentUserId}
        />
      ))}
    </div>
  );
};

export default PresenceIndicator;