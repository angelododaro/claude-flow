import React, { useState } from 'react';
import { AIChatMinimized } from './AIChatMinimized';
import { AIChatFullScreenNew } from './AIChatFullScreenNew';

interface AIChatFloatingProps {
  chatId: string;
  onClose: () => void;
  onFullScreen?: () => void;
}

export const AIChatFloating: React.FC<AIChatFloatingProps> = ({
  chatId,
  onClose,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (isFullScreen) {
    return (
      <AIChatFullScreenNew
        chatId={chatId}
        onClose={() => setIsFullScreen(false)}
      />
    );
  }

  return (
    <AIChatMinimized
      chatId={chatId}
      onClose={onClose}
      onFullScreen={() => setIsFullScreen(true)}
    />
  );
};