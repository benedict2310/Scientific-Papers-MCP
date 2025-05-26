import * as cheerio from 'cheerio';
import axios from 'axios';
import { BaseExtractor, TextExtractionResult, ExtractionConfig } from './base-extractor.js';
import { TextCleaner } from './text-cleaner.js';
import { logger } from '../core/logger.js';

export class HtmlExtractor extends BaseExtractor {
  private textCleaner: TextCleaner;

  constructor(config: ExtractionConfig) {
    super(config);
    this.textCleaner = new TextCleaner(config.cleaningOptions);
  }

  async extractText(url: string): Promise<TextExtractionResult> {
    try {
      logger.info('Starting HTML text extraction', { url });

      // Determine extraction strategy based on URL
      if (url.includes('arxiv.org') || url.includes('ar5iv.labs.arxiv.org')) {
        return await this.extractArxivText(url);
      } else {
        return await this.extractOpenAlexText(url);
      }
    } catch (error) {
      logger.error('HTML text extraction failed', { url, error: (error as Error).message });
      return this.createFailedResult();
    }
  }

  private async extractArxivText(url: string): Promise<TextExtractionResult> {
    let htmlContent: string;
    let source: 'arxiv-html' | 'ar5iv' = 'arxiv-html';

    try {
      // Try main arXiv HTML first
      htmlContent = await this.fetchHtml(url);
    } catch (error) {
      if (!this.config.enableArxivFallback) {
        logger.warn('arXiv HTML extraction failed and fallback disabled', { url });
        return this.createFailedResult();
      }

      // Try ar5iv fallback
      try {
        const arxivId = this.extractArxivId(url);
        const fallbackUrl = `https://ar5iv.labs.arxiv.org/html/${arxivId}`;
        logger.info('Trying ar5iv fallback', { originalUrl: url, fallbackUrl });
        
        htmlContent = await this.fetchHtml(fallbackUrl);
        source = 'ar5iv';
      } catch (fallbackError) {
        logger.error('Both arXiv and ar5iv extraction failed', { 
          url, 
          originalError: (error as Error).message, 
          fallbackError: (fallbackError as Error).message 
        });
        return this.createFailedResult();
      }
    }

    return this.processArxivHtml(htmlContent, source);
  }

  private async extractOpenAlexText(url: string): Promise<TextExtractionResult> {
    if (!this.config.enableOpenAlexExtraction) {
      logger.warn('OpenAlex text extraction disabled', { url });
      return this.createFailedResult();
    }

    try {
      const htmlContent = await this.fetchHtml(url);
      return this.processOpenAlexHtml(htmlContent);
    } catch (error) {
      logger.error('OpenAlex HTML extraction failed', { url, error: (error as Error).message });
      return this.createFailedResult();
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Scientific Paper Harvester MCP Server/1.0'
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  private processArxivHtml(html: string, source: 'arxiv-html' | 'ar5iv'): TextExtractionResult {
    try {
      const $ = cheerio.load(html);

      // Remove unwanted elements
      $('nav, header, footer, aside, script, style, .sidebar, .navigation').remove();

      // arXiv/ar5iv specific selectors
      let content = '';
      
      // Try LaTeX document structure first (common in ar5iv)
      const latexDoc = $('.ltx_document');
      if (latexDoc.length > 0) {
        content = latexDoc.text();
      } else {
        // Fallback to article or main content
        const article = $('article, main, [role="main"], #content');
        if (article.length > 0) {
          content = article.text();
        } else {
          // Last resort: get body text but try to exclude navigation
          $('body nav, body header, body footer, body aside, body .sidebar').remove();
          content = $('body').text();
        }
      }

      // Clean the extracted text
      const cleanedText = this.textCleaner.cleanText(content);
      const { text, truncated } = this.checkTextLength(cleanedText);

      logger.info('arXiv text extraction successful', { 
        source, 
        originalLength: content.length, 
        cleanedLength: cleanedText.length,
        finalLength: text.length,
        truncated 
      });

      return {
        text,
        truncated,
        extractionSuccess: true,
        source
      };
    } catch (error) {
      logger.error('arXiv HTML processing failed', { source, error: (error as Error).message });
      return this.createFailedResult();
    }
  }

  private processOpenAlexHtml(html: string): TextExtractionResult {
    try {
      const $ = cheerio.load(html);

      // Remove unwanted elements
      $('nav, header, footer, aside, script, style, .sidebar, .navigation').remove();

      // Common academic paper selectors
      let content = '';
      
      const contentSelectors = [
        'article',
        '[role="main"]',
        '.paper-content',
        '.article-body',
        '.content',
        'main',
        '#content',
        '.paper-text',
        '.fulltext'
      ];

      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0 && element.text().trim().length > content.length) {
          content = element.text();
        }
      }

      // Fallback if no specific content found
      if (!content.trim()) {
        $('body nav, body header, body footer, body aside, body .sidebar').remove();
        content = $('body').text();
      }

      // Clean the extracted text
      const cleanedText = this.textCleaner.cleanText(content);
      const { text, truncated } = this.checkTextLength(cleanedText);

      logger.info('OpenAlex text extraction successful', { 
        originalLength: content.length, 
        cleanedLength: cleanedText.length,
        finalLength: text.length,
        truncated 
      });

      return {
        text,
        truncated,
        extractionSuccess: true,
        source: 'openalex-html'
      };
    } catch (error) {
      logger.error('OpenAlex HTML processing failed', { error: (error as Error).message });
      return this.createFailedResult();
    }
  }

  private extractArxivId(url: string): string {
    // Extract arXiv ID from various URL formats
    const matches = url.match(/(?:arxiv\.org\/(?:html|abs|pdf)\/|ar5iv\.labs\.arxiv\.org\/html\/)([0-9]{4}\.[0-9]{4,5})/);
    if (!matches) {
      throw new Error(`Could not extract arXiv ID from URL: ${url}`);
    }
    return matches[1];
  }
} 