import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import wsService, { CursorPosition, UserPresence } from '../services/websocket';

interface CursorTrackerProps {
  containerRef: React.RefObject<HTMLElement>;
  currentUserId: string;
}

interface CursorDisplay extends CursorPosition {
  id: string;
}

const CursorTracker: React.FC<CursorTrackerProps> = ({ containerRef, currentUserId }) => {
  const [cursors, setCursors] = useState<Map<string, CursorDisplay>>(new Map());
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const lastPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseIdleTimerRef = useRef<NodeJS.Timeout>();

  // Handle cursor movement
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // Percentage
    const y = ((e.clientY - rect.top) / rect.height) * 100; // Percentage

    // Only send if position changed significantly (reduce network traffic)
    const distance = Math.sqrt(
      Math.pow(x - lastPositionRef.current.x, 2) + 
      Math.pow(y - lastPositionRef.current.y, 2)
    );

    if (distance > 0.5) { // 0.5% threshold
      wsService.sendCursorPosition(x, y);
      lastPositionRef.current = { x, y };
    }

    // Reset idle timer
    if (mouseIdleTimerRef.current) {
      clearTimeout(mouseIdleTimerRef.current);
    }

    // Set user to idle after 5 seconds of no movement
    mouseIdleTimerRef.current = setTimeout(() => {
      wsService.updatePresenceStatus('idle');
    }, 5000);

    // Set user to active if they were idle
    const currentPresence = userPresence.get(currentUserId);
    if (currentPresence?.status === 'idle') {
      wsService.updatePresenceStatus('active');
    }
  }, [containerRef, currentUserId, userPresence]);

  // Setup event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wsService.updatePresenceStatus('away');
      } else {
        wsService.updatePresenceStatus('active');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // WebSocket event handlers
    const handleCursorUpdate = (cursor: CursorPosition) => {
      if (cursor.user_id !== currentUserId) {
        setCursors(prev => {
          const updated = new Map(prev);
          updated.set(cursor.user_id, {
            ...cursor,
            id: cursor.user_id
          });
          return updated;
        });
      }
    };

    const handlePresenceJoin = (data: any) => {
      setUserPresence(prev => {
        const updated = new Map(prev);
        updated.set(data.presence.user_id, data.presence);
        return updated;
      });
    };

    const handlePresenceLeave = (data: any) => {
      setCursors(prev => {
        const updated = new Map(prev);
        updated.delete(data.user_id);
        return updated;
      });
      setUserPresence(prev => {
        const updated = new Map(prev);
        updated.delete(data.user_id);
        return updated;
      });
    };

    const handlePresenceUpdate = (presence: UserPresence) => {
      setUserPresence(prev => {
        const updated = new Map(prev);
        updated.set(presence.user_id, presence);
        return updated;
      });
    };

    wsService.onCursorUpdate(handleCursorUpdate);
    wsService.onPresenceJoin(handlePresenceJoin);
    wsService.onPresenceLeave(handlePresenceLeave);
    wsService.onPresenceUpdate(handlePresenceUpdate);

    // Initial presence
    setUserPresence(wsService.getPresence());

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wsService.off('cursor_update', handleCursorUpdate);
      wsService.off('presence_join', handlePresenceJoin);
      wsService.off('presence_leave', handlePresenceLeave);
      wsService.off('presence_update', handlePresenceUpdate);
      if (mouseIdleTimerRef.current) {
        clearTimeout(mouseIdleTimerRef.current);
      }
    };
  }, [containerRef, currentUserId, handleMouseMove]);

  return (
    <AnimatePresence>
      {Array.from(cursors.values()).map((cursor) => {
        const presence = userPresence.get(cursor.user_id);
        if (!presence || presence.status === 'away') return null;

        return (
          <motion.div
            key={cursor.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: presence.status === 'idle' ? 0.5 : 1, 
              scale: 1,
              x: `${cursor.x}%`,
              y: `${cursor.y}%`
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ 
              type: "spring",
              damping: 30,
              stiffness: 200
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            {/* Cursor pointer */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              style={{ 
                transform: 'translate(-10%, -10%)',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
              }}
            >
              <path
                d="M0 0 L0 16 L4.5 12.5 L7.5 19 L10 17.5 L7 11 L12 11 Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            
            {/* User label */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '10px',
                backgroundColor: cursor.color,
                color: 'white',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              {cursor.user_name}
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};

export default CursorTracker;