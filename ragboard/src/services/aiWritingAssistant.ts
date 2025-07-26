// AI Writing Assistant Service
// This service provides AI-powered writing assistance for rich text content

export interface AIWritingRequest {
  action: 'improve' | 'expand' | 'summarize' | 'rewrite' | 'translate' | 'proofread' | 'generateIdeas' | 'complete';
  content: string;
  context?: string;
  targetLanguage?: string;
  tone?: 'professional' | 'casual' | 'academic' | 'creative' | 'technical';
  length?: 'shorter' | 'same' | 'longer';
}

export interface AIWritingResponse {
  success: boolean;
  suggestions: {
    id: string;
    title: string;
    content: string;
    confidence: number;
    reasoning?: string;
  }[];
  originalContent: string;
  metadata?: {
    wordCount: number;
    readabilityScore?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    detectedLanguage?: string;
  };
}

export interface AIWritingPreferences {
  preferredTone: 'professional' | 'casual' | 'academic' | 'creative' | 'technical';
  defaultAction: string;
  autoCorrect: boolean;
  suggestionsEnabled: boolean;
  realTimeAssistance: boolean;
}

class AIWritingAssistantService {
  private apiEndpoint: string;
  private preferences: AIWritingPreferences;

  constructor() {
    this.apiEndpoint = '/api/ai/writing'; // Backend endpoint
    this.preferences = this.loadPreferences();
  }

  // Load user preferences from localStorage
  private loadPreferences(): AIWritingPreferences {
    const saved = localStorage.getItem('ai_writing_preferences');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Error loading AI writing preferences:', error);
      }
    }
    
    return {
      preferredTone: 'professional',
      defaultAction: 'improve',
      autoCorrect: true,
      suggestionsEnabled: true,
      realTimeAssistance: false,
    };
  }

  // Save preferences to localStorage
  public savePreferences(preferences: Partial<AIWritingPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    localStorage.setItem('ai_writing_preferences', JSON.stringify(this.preferences));
  }

  // Get current preferences
  public getPreferences(): AIWritingPreferences {
    return { ...this.preferences };
  }

  // Main AI assistance method
  public async assistWithWriting(request: AIWritingRequest): Promise<AIWritingResponse> {
    try {
      // For now, we'll simulate AI responses since we don't have a real AI backend
      // In a real implementation, this would call an AI API like OpenAI, Anthropic, etc.
      return await this.simulateAIResponse(request);
    } catch (error) {
      console.error('AI writing assistance error:', error);
      return {
        success: false,
        suggestions: [],
        originalContent: request.content,
      };
    }
  }

  // Simulate AI responses for demonstration purposes
  private async simulateAIResponse(request: AIWritingRequest): Promise<AIWritingResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const metadata = {
      wordCount: request.content.split(/\s+/).length,
      readabilityScore: Math.floor(Math.random() * 100),
      sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as 'positive' | 'neutral' | 'negative',
      detectedLanguage: 'en',
    };

    let suggestions: AIWritingResponse['suggestions'] = [];

    switch (request.action) {
      case 'improve':
        suggestions = [
          {
            id: '1',
            title: 'Enhanced Clarity',
            content: this.improveClarity(request.content),
            confidence: 0.9,
            reasoning: 'Simplified complex sentences and improved word choice for better readability.',
          },
          {
            id: '2',
            title: 'Professional Tone',
            content: this.adjustTone(request.content, 'professional'),
            confidence: 0.85,
            reasoning: 'Adjusted language to be more professional and formal.',
          },
        ];
        break;

      case 'expand':
        suggestions = [
          {
            id: '1',
            title: 'Detailed Expansion',
            content: this.expandContent(request.content),
            confidence: 0.8,
            reasoning: 'Added supporting details and examples to enhance the content.',
          },
        ];
        break;

      case 'summarize':
        suggestions = [
          {
            id: '1',
            title: 'Concise Summary',
            content: this.summarizeContent(request.content),
            confidence: 0.9,
            reasoning: 'Extracted key points and condensed the content while preserving meaning.',
          },
        ];
        break;

      case 'rewrite':
        suggestions = [
          {
            id: '1',
            title: 'Alternative Version 1',
            content: this.rewriteContent(request.content, 1),
            confidence: 0.85,
            reasoning: 'Restructured sentences and varied vocabulary while maintaining the original meaning.',
          },
          {
            id: '2',
            title: 'Alternative Version 2',
            content: this.rewriteContent(request.content, 2),
            confidence: 0.8,
            reasoning: 'Applied a different structural approach with alternative phrasing.',
          },
        ];
        break;

      case 'translate':
        if (request.targetLanguage) {
          suggestions = [
            {
              id: '1',
              title: `Translation to ${request.targetLanguage}`,
              content: `[Translated to ${request.targetLanguage}] ${request.content}`,
              confidence: 0.75,
              reasoning: `Translated the content to ${request.targetLanguage} while preserving meaning and tone.`,
            },
          ];
        }
        break;

      case 'proofread':
        suggestions = [
          {
            id: '1',
            title: 'Grammar & Spelling Corrections',
            content: this.proofreadContent(request.content),
            confidence: 0.95,
            reasoning: 'Fixed grammar errors, spelling mistakes, and improved punctuation.',
          },
        ];
        break;

      case 'generateIdeas':
        suggestions = [
          {
            id: '1',
            title: 'Related Ideas',
            content: this.generateIdeas(request.content),
            confidence: 0.7,
            reasoning: 'Generated related ideas and potential directions to explore.',
          },
        ];
        break;

      case 'complete':
        suggestions = [
          {
            id: '1',
            title: 'Smart Completion',
            content: this.completeContent(request.content),
            confidence: 0.8,
            reasoning: 'Predicted and completed the sentence based on context and common patterns.',
          },
        ];
        break;

      default:
        suggestions = [
          {
            id: '1',
            title: 'General Improvement',
            content: this.improveClarity(request.content),
            confidence: 0.7,
            reasoning: 'Applied general improvements to enhance readability and flow.',
          },
        ];
    }

    return {
      success: true,
      suggestions,
      originalContent: request.content,
      metadata,
    };
  }

  // Helper methods for content transformation (these would be replaced by real AI in production)
  private improveClarity(content: string): string {
    return content
      .replace(/\b(very|really|quite|rather)\s+/gi, '')
      .replace(/\b(in order to)\b/gi, 'to')
      .replace(/\b(due to the fact that)\b/gi, 'because')
      .replace(/\b(at this point in time)\b/gi, 'now')
      + ' [Enhanced for clarity]';
  }

  private adjustTone(content: string, tone: string): string {
    const prefixes = {
      professional: '[Professional tone] ',
      casual: '[Casual tone] ',
      academic: '[Academic tone] ',
      creative: '[Creative tone] ',
      technical: '[Technical tone] ',
    };
    return prefixes[tone as keyof typeof prefixes] + content;
  }

  private expandContent(content: string): string {
    return content + '\n\n[Expanded with additional details, examples, and supporting information to provide more comprehensive coverage of the topic.]';
  }

  private summarizeContent(content: string): string {
    const words = content.split(' ');
    const summary = words.slice(0, Math.max(10, words.length / 3)).join(' ');
    return `[Summary] ${summary}...`;
  }

  private rewriteContent(content: string, version: number): string {
    return `[Rewritten Version ${version}] ${content.split(' ').reverse().join(' ')}`;
  }

  private proofreadContent(content: string): string {
    return content
      .replace(/\bi\b/g, 'I')
      .replace(/\.\s+([a-z])/g, '. $1'.toUpperCase())
      .replace(/\s{2,}/g, ' ')
      + ' [Proofread]';
  }

  private generateIdeas(content: string): string {
    const ideas = [
      '• Explore the historical context of this topic',
      '• Consider the practical applications and real-world examples',
      '• Examine different perspectives and viewpoints',
      '• Discuss potential challenges and solutions',
      '• Connect to current trends and future implications',
    ];
    return content + '\n\n**Related Ideas:**\n' + ideas.join('\n');
  }

  private completeContent(content: string): string {
    const completions = [
      ' and this leads to important considerations.',
      ' which demonstrates the significance of this approach.',
      ' highlighting the need for further investigation.',
      ' and provides valuable insights for future work.',
      ' representing a crucial step forward in understanding.',
    ];
    const randomCompletion = completions[Math.floor(Math.random() * completions.length)];
    return content + randomCompletion;
  }

  // Real-time assistance for autocomplete and suggestions
  public async getAutocompleteSuggestions(partialContent: string, cursorPosition: number): Promise<string[]> {
    if (!this.preferences.realTimeAssistance) {
      return [];
    }

    // Simulate autocomplete suggestions
    await new Promise(resolve => setTimeout(resolve, 200));

    const words = partialContent.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.length < 2) {
      return [];
    }

    // Simple word completion suggestions
    const suggestions = [
      lastWord + 'tion',
      lastWord + 'ing',
      lastWord + 'ed',
      lastWord + 'er',
      lastWord + 'ly',
    ].filter(suggestion => suggestion !== lastWord && suggestion.length > lastWord.length);

    return suggestions.slice(0, 3);
  }

  // Grammar and spell check
  public async checkGrammarAndSpelling(content: string): Promise<{
    errors: { position: number; length: number; message: string; suggestions: string[] }[];
    score: number;
  }> {
    // Simulate grammar checking
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simple error detection simulation
    const errors = [];
    const words = content.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.length > 10 && Math.random() < 0.1) {
        errors.push({
          position: content.indexOf(word),
          length: word.length,
          message: 'Consider using a simpler word',
          suggestions: [word.slice(0, 6), word.slice(0, 4) + 'ed'],
        });
      }
    }

    return {
      errors,
      score: Math.max(0.7, 1 - errors.length * 0.1),
    };
  }

  // Export content in different formats
  public async exportContent(content: string, format: 'markdown' | 'html' | 'plaintext' | 'docx' | 'pdf'): Promise<Blob> {
    let exportedContent: string;
    let mimeType: string;

    switch (format) {
      case 'markdown':
        exportedContent = this.convertToMarkdown(content);
        mimeType = 'text/markdown';
        break;
      case 'html':
        exportedContent = content; // Already HTML from rich text editor
        mimeType = 'text/html';
        break;
      case 'plaintext':
        exportedContent = this.stripHtml(content);
        mimeType = 'text/plain';
        break;
      case 'docx':
        // Would require a library like docx to generate actual Word documents
        exportedContent = this.stripHtml(content);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'pdf':
        // Would require a library like jsPDF to generate actual PDFs
        exportedContent = this.stripHtml(content);
        mimeType = 'application/pdf';
        break;
      default:
        exportedContent = content;
        mimeType = 'text/html';
    }

    return new Blob([exportedContent], { type: mimeType });
  }

  private convertToMarkdown(html: string): string {
    return html
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n\n')
      .replace(/<ul><li>(.*?)<\/li><\/ul>/g, '- $1\n')
      .replace(/<ol><li>(.*?)<\/li><\/ol>/g, '1. $1\n')
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]*>/g, '');
  }

  private stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
}

// Create singleton instance
export const aiWritingAssistant = new AIWritingAssistantService();

export default aiWritingAssistant;