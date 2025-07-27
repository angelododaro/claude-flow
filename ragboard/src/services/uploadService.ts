/**
 * Service for file uploads with RAG pipeline integration
 */

export interface UploadResult {
  id: string;
  filename: string;
  file_size: number;
  resource_type: string | null;
  processing_status: string;
  auto_process: boolean;
  board_id?: string;
  upload_url: string;
  created_at: string;
}

export interface BatchUploadResult {
  uploaded: number;
  failed: number;
  results: UploadResult[];
  errors: Array<{
    filename: string;
    error: string;
  }>;
}

export interface ProcessingStatus {
  id: string;
  filename: string;
  processing_status: string;
  processing_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SupportedTypes {
  supported_extensions: string[];
  resource_types: Record<string, string>;
  max_file_size_mb: number;
  rag_processable_types: string[];
}

export interface UploadProgress {
  filename: string;
  loaded: number;
  total: number;
  percentage: number;
}

class UploadService {
  private readonly baseUrl: string;
  private readonly apiVersion: string = 'v1';

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  }

  private get apiUrl(): string {
    return `${this.baseUrl}/api/${this.apiVersion}`;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    return {
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Upload a single file
   */
  async uploadFile(
    file: File,
    options: {
      boardId?: string;
      description?: string;
      autoProcess?: boolean;
      onProgress?: (progress: UploadProgress) => void;
    } = {}
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.boardId) {
      formData.append('board_id', options.boardId);
    }
    
    if (options.description) {
      formData.append('description', options.description);
    }
    
    formData.append('auto_process', (options.autoProcess !== false).toString());

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Handle progress
      if (options.onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: UploadProgress = {
              filename: file.name,
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            options.onProgress!(progress);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.detail || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: HTTP ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed: Network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Set up request
      xhr.open('POST', `${this.apiUrl}/upload/files`);
      
      // Add auth header
      this.getAuthHeaders().then(headers => {
        Object.entries(headers).forEach(([key, value]) => {
          if (key !== 'Content-Type') { // Don't set Content-Type for FormData
            xhr.setRequestHeader(key, value as string);
          }
        });
        
        // Send request
        xhr.send(formData);
      });
    });
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: File[],
    options: {
      boardId?: string;
      autoProcess?: boolean;
      onProgress?: (filename: string, progress: UploadProgress) => void;
      onFileComplete?: (result: UploadResult) => void;
      onFileError?: (filename: string, error: string) => void;
    } = {}
  ): Promise<BatchUploadResult> {
    if (files.length > 10) {
      throw new Error('Maximum 10 files allowed per batch upload');
    }

    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });
    
    if (options.boardId) {
      formData.append('board_id', options.boardId);
    }
    
    formData.append('auto_process', (options.autoProcess !== false).toString());

    const response = await fetch(`${this.apiUrl}/upload/files/batch`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: formData,
    });

    return this.handleResponse<BatchUploadResult>(response);
  }

  /**
   * Get file processing status
   */
  async getProcessingStatus(resourceId: string): Promise<ProcessingStatus> {
    const response = await fetch(
      `${this.apiUrl}/upload/files/${resourceId}/status`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse<ProcessingStatus>(response);
  }

  /**
   * Reprocess a file through RAG pipeline
   */
  async reprocessFile(resourceId: string): Promise<{
    id: string;
    status: string;
    message: string;
  }> {
    const response = await fetch(
      `${this.apiUrl}/upload/files/${resourceId}/reprocess`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  /**
   * Delete an uploaded file
   */
  async deleteFile(resourceId: string): Promise<{
    id: string;
    status: string;
    message: string;
  }> {
    const response = await fetch(
      `${this.apiUrl}/upload/files/${resourceId}`,
      {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  /**
   * Get supported file types
   */
  async getSupportedTypes(): Promise<SupportedTypes> {
    const response = await fetch(
      `${this.apiUrl}/upload/files/supported-types`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse<SupportedTypes>(response);
  }

  /**
   * Check if file type is supported
   */
  isFileTypeSupported(filename: string, supportedTypes?: SupportedTypes): boolean {
    if (!supportedTypes) return true; // Assume supported if not checked
    
    const extension = '.' + filename.split('.').pop()?.toLowerCase();
    return supportedTypes.supported_extensions.includes(extension);
  }

  /**
   * Check if file size is within limits
   */
  isFileSizeValid(fileSize: number, supportedTypes?: SupportedTypes): boolean {
    if (!supportedTypes) return true; // Assume valid if not checked
    
    const maxSizeMB = supportedTypes.max_file_size_mb;
    const fileSizeMB = fileSize / (1024 * 1024);
    return fileSizeMB <= maxSizeMB;
  }

  /**
   * Validate file before upload
   */
  async validateFile(file: File): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      const supportedTypes = await this.getSupportedTypes();
      
      if (!this.isFileTypeSupported(file.name, supportedTypes)) {
        errors.push(`File type not supported. Allowed: ${supportedTypes.supported_extensions.join(', ')}`);
      }
      
      if (!this.isFileSizeValid(file.size, supportedTypes)) {
        errors.push(`File too large. Maximum size: ${supportedTypes.max_file_size_mb}MB`);
      }
      
    } catch (error) {
      errors.push('Unable to validate file type restrictions');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Monitor processing status with polling
   */
  async monitorProcessing(
    resourceId: string,
    options: {
      onStatusChange?: (status: ProcessingStatus) => void;
      onComplete?: (status: ProcessingStatus) => void;
      onError?: (error: string) => void;
      pollInterval?: number;
      maxPollTime?: number;
    } = {}
  ): Promise<ProcessingStatus> {
    const pollInterval = options.pollInterval || 2000; // 2 seconds
    const maxPollTime = options.maxPollTime || 300000; // 5 minutes
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getProcessingStatus(resourceId);
          
          if (options.onStatusChange) {
            options.onStatusChange(status);
          }
          
          if (status.processing_status === 'completed') {
            if (options.onComplete) {
              options.onComplete(status);
            }
            resolve(status);
            return;
          }
          
          if (status.processing_status === 'failed') {
            const error = status.processing_metadata?.error || 'Processing failed';
            if (options.onError) {
              options.onError(error);
            }
            reject(new Error(error));
            return;
          }
          
          // Check timeout
          if (Date.now() - startTime > maxPollTime) {
            reject(new Error('Processing timeout'));
            return;
          }
          
          // Continue polling
          setTimeout(poll, pollInterval);
          
        } catch (error) {
          if (options.onError) {
            options.onError(error instanceof Error ? error.message : 'Unknown error');
          }
          reject(error);
        }
      };
      
      poll();
    });
  }

  /**
   * Upload file with automatic monitoring
   */
  async uploadAndMonitor(
    file: File,
    options: {
      boardId?: string;
      description?: string;
      autoProcess?: boolean;
      onUploadProgress?: (progress: UploadProgress) => void;
      onProcessingUpdate?: (status: ProcessingStatus) => void;
      onComplete?: (result: UploadResult, status?: ProcessingStatus) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<{ uploadResult: UploadResult; processingStatus?: ProcessingStatus }> {
    try {
      // Validate file first
      const validation = await this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Upload file
      const uploadResult = await this.uploadFile(file, {
        boardId: options.boardId,
        description: options.description,
        autoProcess: options.autoProcess,
        onProgress: options.onUploadProgress,
      });

      // Monitor processing if auto-process is enabled
      if (options.autoProcess !== false && uploadResult.processing_status === 'processing') {
        try {
          const processingStatus = await this.monitorProcessing(uploadResult.id, {
            onStatusChange: options.onProcessingUpdate,
            onComplete: (status) => {
              if (options.onComplete) {
                options.onComplete(uploadResult, status);
              }
            },
            onError: options.onError,
          });

          return { uploadResult, processingStatus };
        } catch (processingError) {
          // Upload succeeded but processing failed
          return { uploadResult };
        }
      }

      if (options.onComplete) {
        options.onComplete(uploadResult);
      }

      return { uploadResult };
    } catch (error) {
      if (options.onError) {
        options.onError(error instanceof Error ? error.message : 'Unknown error');
      }
      throw error;
    }
  }
}

// Export singleton instance
export const uploadService = new UploadService();
export default uploadService;