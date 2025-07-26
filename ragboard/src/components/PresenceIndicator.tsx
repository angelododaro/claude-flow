import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import wsService, { UserPresence } from '../services/websocket';

interface PresenceIndicatorProps {
  currentUserId: string;
}

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ currentUserId }) => {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    const updatePresence = () => {
      const presence = wsService.getPresence();
      const users = Array.from(presence.values())
        .filter(user => user.user_id !== currentUserId)
        .sort((a, b) => a.user_name.localeCompare(b.user_name));
      setActiveUsers(users);
    };

    // Initial update
    updatePresence();

    // WebSocket event handlers
    const handlePresenceUpdate = () => {
      updatePresence();
    };

    wsService.onPresenceJoin(handlePresenceUpdate);
    wsService.onPresenceLeave(handlePresenceUpdate);
    wsService.onPresenceUpdate(handlePresenceUpdate);

    return () => {
      wsService.off('presence_join', handlePresenceUpdate);
      wsService.off('presence_leave', handlePresenceUpdate);
      wsService.off('presence_update', handlePresenceUpdate);
    };
  }, [currentUserId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        );
      case 'idle':
        return (
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
        );
      case 'away':
        return (
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Active Users ({activeUsers.length + 1})
        </h3>
        
        {/* Current user */}
        <div className="flex items-center gap-2 mb-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: '#4F46E5' }}
          />
          <span className="text-gray-700 font-medium">You</span>
          {getStatusIcon('active')}
        </div>

        {/* Other users */}
        <AnimatePresence>
          {activeUsers.map((user) => (
            <motion.div
              key={user.user_id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 mb-2 text-sm"
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: user.color }}
              />
              <span className="text-gray-700 flex-1 truncate">
                {user.user_name}
              </span>
              {getStatusIcon(user.status)}
            </motion.div>
          ))}
        </AnimatePresence>

        {activeUsers.length === 0 && (
          <p className="text-xs text-gray-500 italic">
            No other users online
          </p>
        )}
      </div>

      {/* Collaboration indicator */}
      {activeUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-2 bg-green-100 text-green-800 text-xs rounded-lg px-3 py-2 text-center"
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Live collaboration active</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PresenceIndicator;