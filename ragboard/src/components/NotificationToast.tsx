import React, { useEffect, useState } from 'react';
import wsService from '../services/websocket';
import './NotificationToast.css';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  actions?: Array<{
    label: string;
    action: () => void;
    type?: 'primary' | 'secondary';
  }>;
}

interface NotificationToastProps {
  maxNotifications?: number;
  autoHideDuration?: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  maxNotifications = 5,
  autoHideDuration = 5000
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const handleNotification = (data: any) => {
      const notification: Notification = {
        id: data.id || `notification-${Date.now()}-${Math.random()}`,
        type: data.type || 'info',
        title: data.title || 'Notification',
        message: data.message || '',
        timestamp: Date.now(),
        actions: data.actions
      };

      setNotifications(prev => {
        const updated = [notification, ...prev];
        // Limit to maxNotifications
        return updated.slice(0, maxNotifications);
      });

      // Auto-hide if no actions and autoHideDuration is set
      if (!notification.actions && autoHideDuration > 0) {
        setTimeout(() => {
          removeNotification(notification.id);
        }, autoHideDuration);
      }
    };

    wsService.onNotification(handleNotification);

    return () => {
      wsService.removeAllListeners('notification');
    };
  }, [maxNotifications, autoHideDuration]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification-toast notification-${notification.type}`}
        >
          <div className="notification-header">
            <div className="notification-icon">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="notification-title">
              {notification.title}
            </div>
            <div className="notification-time">
              {formatTime(notification.timestamp)}
            </div>
            <button
              className="notification-close"
              onClick={() => removeNotification(notification.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
          
          {notification.message && (
            <div className="notification-message">
              {notification.message}
            </div>
          )}
          
          {notification.actions && notification.actions.length > 0 && (
            <div className="notification-actions">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  className={`notification-action ${action.type || 'secondary'}`}
                  onClick={() => {
                    action.action();
                    removeNotification(notification.id);
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Helper function to send notifications programmatically
export const showNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
  // This would typically be called by the WebSocket service
  // For now, we'll emit it directly
  const event = new CustomEvent('ws-notification', {
    detail: {
      ...notification,
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    }
  });
  
  window.dispatchEvent(event);
};

export default NotificationToast;