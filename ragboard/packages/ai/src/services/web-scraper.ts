import axios from 'axios'
import * as cheerio from 'cheerio'

export interface ScrapedContent {
  url: string
  title: string
  content: string
  description?: string
  images?: string[]
  links?: string[]
  metadata?: Record<string, any>
}

export class WebScraperService {
  async scrapeURL(url: string): Promise<ScrapedContent> {
    try {
      // Fetch the page
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RAGBoard/1.0)',
        },
        timeout: 10000,
      })

      const $ = cheerio.load(response.data)

      // Extract title
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   'Untitled'

      // Extract description
      const description = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content') ||
                         ''

      // Remove script and style elements
      $('script, style, noscript').remove()

      // Extract main content
      let content = ''
      
      // Try to find main content areas
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.content',
        '#content',
        '.post',
        '.entry-content',
      ]

      for (const selector of contentSelectors) {
        const element = $(selector)
        if (element.length > 0) {
          content = element.text().trim()
          break
        }
      }

      // Fallback to body if no main content found
      if (!content) {
        content = $('body').text().trim()
      }

      // Clean up content
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // Extract images
      const images: string[] = []
      $('img').each((_, img) => {
        const src = $(img).attr('src')
        if (src) {
          // Convert relative URLs to absolute
          try {
            const imgUrl = new URL(src, url).toString()
            images.push(imgUrl)
          } catch {
            // Skip invalid URLs
          }
        }
      })

      // Extract links
      const links: string[] = []
      $('a').each((_, link) => {
        const href = $(link).attr('href')
        if (href && !href.startsWith('#')) {
          try {
            const linkUrl = new URL(href, url).toString()
            links.push(linkUrl)
          } catch {
            // Skip invalid URLs
          }
        }
      })

      // Extract metadata
      const metadata: Record<string, any> = {
        ogTitle: $('meta[property="og:title"]').attr('content'),
        ogImage: $('meta[property="og:image"]').attr('content'),
        author: $('meta[name="author"]').attr('content'),
        publishedTime: $('meta[property="article:published_time"]').attr('content'),
        modifiedTime: $('meta[property="article:modified_time"]').attr('content'),
      }

      // Clean up metadata
      Object.keys(metadata).forEach(key => {
        if (!metadata[key]) {
          delete metadata[key]
        }
      })

      return {
        url,
        title,
        content: content.slice(0, 10000), // Limit content length
        description,
        images: images.slice(0, 10), // Limit number of images
        links: [...new Set(links)].slice(0, 20), // Unique links, limited
        metadata,
      }
    } catch (error) {
      console.error('Error scraping URL:', error)
      throw new Error(`Failed to scrape URL: ${url}`)
    }
  }

  async scrapeMultiple(urls: string[]): Promise<ScrapedContent[]> {
    const results = await Promise.allSettled(
      urls.map(url => this.scrapeURL(url))
    )

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<ScrapedContent>).value)
  }

  extractDomain(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.hostname
    } catch {
      return 'unknown'
    }
  }

  isValidURL(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}