import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Resource, AIChat, Message } from '../types';
import { API_BASE_URL, API_V1_PREFIX } from '../config/api';

// Create axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh or redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Service class
export class ApiService {
  // Auth endpoints
  static async login(email: string, password: string) {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  }

  static async register(email: string, password: string, name: string) {
    const response = await apiClient.post('/auth/register', { email, password, name });
    return response.data;
  }

  static async logout() {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('auth_token');
  }

  // Resource endpoints
  static async uploadResource(file: File, metadata?: any): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
    }

    const response = await apiClient.post(`${API_V1_PREFIX}/resources/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 1)
        );
        // Emit progress event
        window.dispatchEvent(new CustomEvent('upload-progress', { 
          detail: { percentCompleted, file: file.name } 
        }));
      },
    });
    return response.data;
  }

  static async processURL(url: string, platform?: string): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/resources/url`, { 
      name: url.split('/').pop() || 'Web Resource',
      source_url: url,
      source_metadata: { platform }
    });
    return response.data;
  }

  static async processText(title: string, content: string): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/resources/text`, { 
      name: title,
      content: content,
      resource_type: 'text'
    });
    return response.data;
  }

  static async deleteResource(resourceId: string): Promise<void> {
    await apiClient.delete(`/resources/${resourceId}`);
  }

  static async getResources(): Promise<Resource[]> {
    const response = await apiClient.get('/resources');
    return response.data;
  }

  // AI Chat endpoints
  static async createChat(boardId: string): Promise<AIChat> {
    const response = await apiClient.post('/chats', { boardId });
    return response.data;
  }

  static async sendMessage(
    chatId: string, 
    message: string, 
    connectedResources: string[]
  ): Promise<Message> {
    const response = await apiClient.post(`/chats/${chatId}/messages`, {
      message,
      connected_resources: connectedResources,
    });
    return response.data;
  }

  static async streamMessage(
    chatId: string,
    message: string,
    connectedResources: string[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}${API_V1_PREFIX}/chats/${chatId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({
        message,
        connected_resources: connectedResources,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              onChunk(data.content);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }
  }

  static async getChatHistory(chatId: string): Promise<Message[]> {
    const response = await apiClient.get(`/chats/${chatId}/messages`);
    return response.data;
  }

  // Board endpoints
  static async createBoard(name: string): Promise<any> {
    const response = await apiClient.post('/boards', { name });
    return response.data;
  }

  static async getBoard(boardId: string): Promise<any> {
    const response = await apiClient.get(`/boards/${boardId}`);
    return response.data;
  }

  static async saveBoard(boardData: {
    name: string;
    resources: Resource[];
    connections: any[];
    aiChats: AIChat[];
  }): Promise<void> {
    await apiClient.post('/boards/save', boardData);
  }

  static async loadBoard(boardId: string): Promise<{
    name: string;
    resources: Resource[];
    connections: any[];
    aiChats: AIChat[];
  }> {
    const response = await apiClient.get(`/boards/${boardId}/load`);
    return response.data;
  }

  static async listBoards(): Promise<Array<{
    id: string;
    name: string;
    updatedAt: Date;
  }>> {
    const response = await apiClient.get('/boards');
    return response.data.map((board: any) => ({
      ...board,
      updatedAt: new Date(board.updatedAt || board.updated_at)
    }));
  }

  // Vector search endpoints
  static async searchSimilar(query: string, boardId: string): Promise<any[]> {
    const response = await apiClient.post('/search/similar', { 
      query, 
      board_id: boardId 
    });
    return response.data;
  }

  // Processing status endpoints
  static async getProcessingStatus(resourceId: string): Promise<any> {
    const response = await apiClient.get(`/processing/status/${resourceId}`);
    return response.data;
  }

  // Comment endpoints
  static async createComment(commentData: {
    content: string;
    content_type?: string;
    comment_type?: string;
    board_id?: string;
    resource_id?: string;
    frame_id?: string;
    card_id?: string;
    position_x?: number;
    position_y?: number;
    parent_id?: string;
    mentioned_users?: string[];
    is_private?: boolean;
  }): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/comments/`, commentData);
    return response.data;
  }

  static async getComments(params?: {
    board_id?: string;
    resource_id?: string;
    parent_id?: string;
    thread_id?: string;
    author_id?: string;
    comment_type?: string;
    is_resolved?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<any> {
    const response = await apiClient.get(`${API_V1_PREFIX}/comments/`, { params });
    return response.data;
  }

  static async getComment(commentId: string, includeReplies: boolean = true): Promise<any> {
    const response = await apiClient.get(`${API_V1_PREFIX}/comments/${commentId}`, {
      params: { include_replies: includeReplies }
    });
    return response.data;
  }

  static async updateComment(commentId: string, updateData: {
    content?: string;
    comment_type?: string;
    is_resolved?: boolean;
    is_pinned?: boolean;
    is_private?: boolean;
  }): Promise<any> {
    const response = await apiClient.put(`${API_V1_PREFIX}/comments/${commentId}`, updateData);
    return response.data;
  }

  static async deleteComment(commentId: string): Promise<void> {
    await apiClient.delete(`${API_V1_PREFIX}/comments/${commentId}`);
  }

  static async likeComment(commentId: string, reactionType: string = 'like'): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/comments/${commentId}/like`, {
      reaction_type: reactionType
    });
    return response.data;
  }

  static async unlikeComment(commentId: string): Promise<void> {
    await apiClient.delete(`${API_V1_PREFIX}/comments/${commentId}/like`);
  }

  static async resolveComment(commentId: string): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/comments/${commentId}/resolve`);
    return response.data;
  }

  static async unresolveComment(commentId: string): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/comments/${commentId}/unresolve`);
    return response.data;
  }

  static async searchComments(searchData: {
    query?: string;
    board_id?: string;
    resource_id?: string;
    comment_type?: string;
    author_id?: string;
    is_resolved?: boolean;
    date_from?: string;
    date_to?: string;
    limit?: number;
    skip?: number;
  }): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/comments/search`, searchData);
    return response.data;
  }

  static async getCommentStats(params?: {
    board_id?: string;
    resource_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<any> {
    const response = await apiClient.get(`${API_V1_PREFIX}/comments/stats/overview`, { params });
    return response.data;
  }

  // Comment Thread endpoints
  static async createThread(threadData: {
    title?: string;
    description?: string;
    board_id?: string;
    resource_id?: string;
  }): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/comments/threads`, threadData);
    return response.data;
  }

  static async getThreads(params?: {
    board_id?: string;
    resource_id?: string;
    is_resolved?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<any[]> {
    const response = await apiClient.get(`${API_V1_PREFIX}/comments/threads`, { params });
    return response.data;
  }

  static async getThread(threadId: string, includeComments: boolean = true): Promise<any> {
    const response = await apiClient.get(`${API_V1_PREFIX}/comments/threads/${threadId}`, {
      params: { include_comments: includeComments }
    });
    return response.data;
  }

  static async updateThread(threadId: string, updateData: {
    title?: string;
    description?: string;
    is_locked?: boolean;
    is_resolved?: boolean;
    is_pinned?: boolean;
  }): Promise<any> {
    const response = await apiClient.put(`${API_V1_PREFIX}/comments/threads/${threadId}`, updateData);
    return response.data;
  }

  static async deleteThread(threadId: string): Promise<void> {
    await apiClient.delete(`${API_V1_PREFIX}/comments/threads/${threadId}`);
  }

  // Notification endpoints
  static async getNotifications(params?: {
    unread_only?: boolean;
    notification_type?: string;
    skip?: number;
    limit?: number;
  }): Promise<any> {
    const response = await apiClient.get(`${API_V1_PREFIX}/notifications/`, { params });
    return response.data;
  }

  static async getNotification(notificationId: string): Promise<any> {
    const response = await apiClient.get(`${API_V1_PREFIX}/notifications/${notificationId}`);
    return response.data;
  }

  static async markNotificationRead(notificationId: string): Promise<any> {
    const response = await apiClient.put(`${API_V1_PREFIX}/notifications/${notificationId}`, {
      is_read: true
    });
    return response.data;
  }

  static async markAllNotificationsRead(notificationType?: string): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/notifications/mark-all-read`, {
      notification_type: notificationType
    });
    return response.data;
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    await apiClient.delete(`${API_V1_PREFIX}/notifications/${notificationId}`);
  }

  static async getUnreadNotificationCount(): Promise<number> {
    const response = await apiClient.get(`${API_V1_PREFIX}/notifications/unread-count`);
    return response.data.unread_count;
  }

  static async getRecentNotifications(limit: number = 5): Promise<any[]> {
    const response = await apiClient.get(`${API_V1_PREFIX}/notifications/recent`, {
      params: { limit }
    });
    return response.data.notifications;
  }

  static async getNotificationStats(): Promise<any> {
    const response = await apiClient.get(`${API_V1_PREFIX}/notifications/stats/overview`);
    return response.data;
  }

  // Notification Preferences
  static async getNotificationPreferences(): Promise<any[]> {
    const response = await apiClient.get(`${API_V1_PREFIX}/notifications/preferences/`);
    return response.data;
  }

  static async updateNotificationPreference(preferenceData: {
    notification_type: string;
    email_enabled?: boolean;
    push_enabled?: boolean;
    in_app_enabled?: boolean;
    immediate?: boolean;
    daily_digest?: boolean;
    weekly_digest?: boolean;
  }): Promise<any> {
    const response = await apiClient.post(`${API_V1_PREFIX}/notifications/preferences/`, preferenceData);
    return response.data;
  }
}

// Export both named and default
export { apiClient };
export default apiClient;