/**
 * Service for semantic search and RAG pipeline operations
 */

export interface SearchResult {
  id: string;
  content: string;
  similarity_score: number;
  metadata: {
    resource_id: string;
    user_id: string;
    board_id?: string;
    resource_type: string;
    chunk_index: number;
    chunk_start: number;
    chunk_end: number;
    total_chunks: number;
    file_path?: string;
    created_at: string;
  };
  resource_id: string;
  resource_type: string;
  chunk_index: number;
  created_at: string;
  title?: string;
  resource?: {
    id: string;
    name: string;
    type: string;
    url?: string;
    created_at: string;
  };
}

export interface SearchResponse {
  query: string;
  total_results: number;
  results: SearchResult[];
  search_metadata: {
    board_id?: string;
    resource_types?: string[];
    score_threshold: number;
    user_id: string;
  };
}

export interface ContextResponse {
  query: string;
  context: string;
  sources: Array<{
    resource_id: string;
    chunk_index: number;
    score: number;
  }>;
  context_length: number;
  source_count: number;
  board_id: string;
}

export interface SearchSuggestion {
  text: string;
  count?: number;
  resource_type?: string;
}

export interface SearchParams {
  query: string;
  boardId?: string;
  resourceTypes?: string[];
  limit?: number;
  scoreThreshold?: number;
}

export interface SuggestionParams {
  query: string;
  boardId?: string;
  limit?: number;
}

export interface SearchStats {
  rag_pipeline: {
    embedding_provider: string;
    embedding_dimension: number;
    vector_store: any;
  };
  resources: {
    total: number;
    processed: number;
    processing_rate: number;
    by_type: Record<string, number>;
  };
  board_id?: string;
  user_id: string;
}

class SearchService {
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
      'Content-Type': 'application/json',
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
   * Perform semantic search across processed resources
   */
  async semanticSearch(params: {
    query: string;
    boardId?: string;
    resourceTypes?: string[];
    limit?: number;
    scoreThreshold?: number;
  }): Promise<SearchResponse> {
    const searchParams = new URLSearchParams({
      query: params.query,
      ...(params.boardId && { board_id: params.boardId }),
      ...(params.limit && { limit: params.limit.toString() }),
      ...(params.scoreThreshold && { score_threshold: params.scoreThreshold.toString() }),
    });

    // Add resource types as multiple query parameters
    if (params.resourceTypes) {
      params.resourceTypes.forEach(type => {
        searchParams.append('resource_types', type);
      });
    }

    const response = await fetch(
      `${this.apiUrl}/search/semantic?${searchParams}`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse<SearchResponse>(response);
  }

  /**
   * Get relevant context for AI chat based on search query
   */
  async getSearchContext(params: {
    query: string;
    boardId: string;
    resourceIds?: string[];
    maxContextLength?: number;
  }): Promise<ContextResponse> {
    const response = await fetch(`${this.apiUrl}/search/context`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({
        query: params.query,
        board_id: params.boardId,
        resource_ids: params.resourceIds,
        max_context_length: params.maxContextLength || 3000,
      }),
    });

    return this.handleResponse<ContextResponse>(response);
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(params: {
    partialQuery: string;
    boardId?: string;
    limit?: number;
  }): Promise<{ partial_query: string; suggestions: SearchSuggestion[]; board_id?: string }> {
    const searchParams = new URLSearchParams({
      partial_query: params.partialQuery,
      ...(params.boardId && { board_id: params.boardId }),
      ...(params.limit && { limit: params.limit.toString() }),
    });

    const response = await fetch(
      `${this.apiUrl}/search/suggestions?${searchParams}`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  /**
   * Get search and indexing statistics
   */
  async getSearchStats(boardId?: string): Promise<SearchStats> {
    const searchParams = new URLSearchParams({
      ...(boardId && { board_id: boardId }),
    });

    const response = await fetch(
      `${this.apiUrl}/search/stats?${searchParams}`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse<SearchStats>(response);
  }

  /**
   * Process a resource through the RAG pipeline
   */
  async processResource(
    resourceId: string,
    forceReprocess: boolean = false
  ): Promise<{
    resource_id: string;
    status: string;
    message: string;
  }> {
    const searchParams = new URLSearchParams({
      ...(forceReprocess && { force_reprocess: 'true' }),
    });

    const response = await fetch(
      `${this.apiUrl}/search/resources/${resourceId}/process?${searchParams}`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  /**
   * Delete embeddings for a resource
   */
  async deleteResourceEmbeddings(resourceId: string): Promise<{
    resource_id: string;
    status: string;
    message: string;
  }> {
    const response = await fetch(
      `${this.apiUrl}/search/resources/${resourceId}/embeddings`,
      {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  /**
   * Advanced search with filters and sorting
   */
  async advancedSearch(params: {
    query: string;
    boardId?: string;
    resourceTypes?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    sortBy?: 'relevance' | 'date' | 'type';
    limit?: number;
    offset?: number;
    scoreThreshold?: number;
  }): Promise<SearchResponse> {
    // For now, delegate to semantic search
    // In the future, this could include more advanced filtering
    return this.semanticSearch({
      query: params.query,
      boardId: params.boardId,
      resourceTypes: params.resourceTypes,
      limit: params.limit,
      scoreThreshold: params.scoreThreshold,
    });
  }

  /**
   * Search within a specific resource type
   */
  async searchByType(
    query: string,
    resourceType: string,
    boardId?: string,
    limit: number = 10
  ): Promise<SearchResponse> {
    return this.semanticSearch({
      query,
      boardId,
      resourceTypes: [resourceType],
      limit,
    });
  }

  /**
   * Get similar resources based on a given resource
   */
  async findSimilarResources(
    resourceId: string,
    boardId?: string,
    limit: number = 5
  ): Promise<SearchResponse> {
    // This would require the resource's content as a query
    // For now, we'll use the resource ID as a basic search
    return this.semanticSearch({
      query: `resource:${resourceId}`,
      boardId,
      limit,
    });
  }

  /**
   * Batch process multiple resources
   */
  async batchProcessResources(
    resourceIds: string[],
    forceReprocess: boolean = false
  ): Promise<Array<{ resource_id: string; status: string; message: string }>> {
    const results = await Promise.allSettled(
      resourceIds.map(id => this.processResource(id, forceReprocess))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          resource_id: resourceIds[index],
          status: 'error',
          message: result.reason.message || 'Unknown error',
        };
      }
    });
  }

  /**
   * Check if a resource is processed and ready for search
   */
  async isResourceProcessed(resourceId: string): Promise<boolean> {
    try {
      const results = await this.semanticSearch({
        query: `resource:${resourceId}`,
        limit: 1,
      });
      return results.total_results > 0;
    } catch (error) {
      console.error('Error checking resource processing status:', error);
      return false;
    }
  }

  /**
   * Get processing progress for resources in a board
   */
  async getProcessingProgress(boardId: string): Promise<{
    total: number;
    processed: number;
    processing_rate: number;
  }> {
    const stats = await this.getSearchStats(boardId);
    return stats.resources;
  }

  /**
   * Convenience method for UI components - returns just the results array
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    const response = await this.semanticSearch(params);
    return response.results;
  }

  /**
   * Get search suggestions for UI components
   */
  async getSuggestions(params: SuggestionParams): Promise<SearchSuggestion[]> {
    const response = await this.getSearchSuggestions({
      partialQuery: params.query,
      boardId: params.boardId,
      limit: params.limit
    });
    return response.suggestions;
  }
}

// Export singleton instance
export const searchService = new SearchService();
export default searchService;