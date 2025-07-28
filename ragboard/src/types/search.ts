// Search-related type definitions
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