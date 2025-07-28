// WebSocket-related type definitions
export interface UserPresence {
  userId: string;
  userName: string;
  color: string;
  cursor?: CursorPosition;
  lastSeen: Date;
}

export interface CursorPosition {
  x: number;
  y: number;
  viewportX: number;
  viewportY: number;
}