import pdf from 'pdf-parse'

export interface ExtractedDocument {
  text: string
  pageCount: number
  metadata?: {
    title?: string
    author?: string
    subject?: string
    keywords?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
  }
}

export class DocumentService {
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer)
      return data.text
    } catch (error) {
      console.error('Error extracting PDF text:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  async extractFullPDFData(buffer: Buffer): Promise<ExtractedDocument> {
    try {
      const data = await pdf(buffer)
      
      return {
        text: data.text,
        pageCount: data.numpages,
        metadata: {
          title: data.info?.Title,
          author: data.info?.Author,
          subject: data.info?.Subject,
          keywords: data.info?.Keywords,
          creator: data.info?.Creator,
          producer: data.info?.Producer,
          creationDate: data.info?.CreationDate,
          modificationDate: data.info?.ModDate,
        },
      }
    } catch (error) {
      console.error('Error extracting PDF data:', error)
      throw new Error('Failed to extract data from PDF')
    }
  }

  async extractTextFromFile(
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractTextFromPDF(buffer)
      
      case 'text/plain':
      case 'text/markdown':
      case 'text/csv':
        return buffer.toString('utf-8')
      
      case 'application/json':
        try {
          const json = JSON.parse(buffer.toString('utf-8'))
          return JSON.stringify(json, null, 2)
        } catch {
          return buffer.toString('utf-8')
        }
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`)
    }
  }

  detectMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',
      json: 'application/json',
    }
    
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  async chunckDocument(
    text: string,
    chunkSize: number = 1000,
    overlap: number = 200
  ): Promise<string[]> {
    const chunks: string[] = []
    let start = 0
    
    while (start < text.length) {
      const end = start + chunkSize
      const chunk = text.slice(start, end)
      chunks.push(chunk)
      start = end - overlap
    }
    
    return chunks
  }
}