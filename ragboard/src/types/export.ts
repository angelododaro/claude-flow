// Export-related type definitions
export interface ExportOptions {
  format: 'json' | 'png' | 'svg' | 'pdf';
  includeMetadata?: boolean;
  quality?: number;
  scale?: number;
}