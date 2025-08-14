import { describe, it, expect, vi, beforeEach } from 'vitest';
import nock from 'nock';
import { fetchPdfContent, fetchPdfContentSchema } from '../../src/tools/fetch-pdf-content.js';

// Mock the PdfExtractor since we want to test the tool logic, not the extraction implementation
vi.mock('../../src/extractors/pdf-extractor.js', () => ({
  PdfExtractor: vi.fn().mockImplementation(() => ({
    extractText: vi.fn()
  }))
}));

vi.mock('../../src/config/constants.js', () => ({
  DEFAULT_TEXT_EXTRACTION_CONFIG: {
    maxSizeMB: 6,
    timeoutMs: 30000
  }
}));

describe('fetchPdfContent', () => {
  let mockPdfExtractor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    nock.cleanAll();
    
    // Reset the mock implementation
    const { PdfExtractor } = await import('../../src/extractors/pdf-extractor.js');
    mockPdfExtractor = {
      extractText: vi.fn()
    };
    (PdfExtractor as any).mockImplementation(() => mockPdfExtractor);
  });

  describe('Input validation', () => {
    it('should validate URL format', async () => {
      const result1 = await fetchPdfContent({
        url: 'not-a-valid-url'
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Invalid url');

      // FTP URLs are technically valid URLs but will fail during extraction
      // Mock extractor to return error for unsupported protocols
      mockPdfExtractor.extractText.mockRejectedValue(new Error('Unsupported protocol: ftp'));
      
      const result2 = await fetchPdfContent({
        url: 'ftp://example.com/file.pdf'
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Unsupported protocol');
    });

    it('should validate maxSizeMB parameter', async () => {
      const result1 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxSizeMB: 0
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Number must be greater than or equal to 1');

      const result2 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxSizeMB: 101
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Number must be less than or equal to 100');

      const result3 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxSizeMB: -5
      });
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Number must be greater than or equal to 1');
    });

    it('should validate maxPages parameter', async () => {
      const result1 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxPages: 0
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Number must be greater than or equal to 1');

      const result2 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxPages: 501
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Number must be less than or equal to 500');

      const result3 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxPages: -10
      });
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Number must be greater than or equal to 1');
    });

    it('should validate timeout parameter', async () => {
      const result1 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        timeout: 5
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Number must be greater than or equal to 10');

      const result2 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        timeout: 301
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Number must be less than or equal to 300');

      const result3 = await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        timeout: -30
      });
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('Number must be greater than or equal to 10');
    });

    it('should use default values when parameters are not provided', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Default parameters test',
        metadata: {
          pageCount: 5,
          pdfSize: 2.0,
          url: 'https://arxiv.org/pdf/test.pdf'
        }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://arxiv.org/pdf/test.pdf'
      });

      expect(result.success).toBe(true);
      
      // Verify PdfExtractor was called with default values
      const { PdfExtractor } = await import('../../src/extractors/pdf-extractor.js');
      expect(PdfExtractor).toHaveBeenCalledWith(
        expect.any(Object), // DEFAULT_TEXT_EXTRACTION_CONFIG
        {
          maxSizeMB: 50,
          timeoutMs: 120000, // 120 seconds * 1000
          maxPages: 100,
          requireConfirmation: false,
          interactive: false
        }
      );
    });
  });

  describe('Successful PDF extraction', () => {
    it('should extract text from a PDF successfully', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'This is the extracted PDF content. It contains important research findings.',
        metadata: {
          pageCount: 10,
          pdfSize: 1.5,
          extractionTime: 2345,
          url: 'https://arxiv.org/pdf/2305.11176.pdf'
        },
        truncated: false
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://arxiv.org/pdf/2305.11176.pdf',
        maxSizeMB: 10,
        maxPages: 50,
        timeout: 60,
        confirmLargeFiles: false
      });

      expect(result.success).toBe(true);
      expect(result.text).toBe('This is the extracted PDF content. It contains important research findings.');
      expect(result.metadata).toEqual({
        pageCount: 10,
        sizeBytes: Math.round(1.5 * 1024 * 1024),
        sizeMB: 1.5,
        extractionTime: 2345,
        extractionSource: 'pdf',
        textTruncated: false,
        contextWarning: undefined
      });

      // Verify PdfExtractor was called with correct parameters
      expect(mockPdfExtractor.extractText).toHaveBeenCalledWith(
        'https://arxiv.org/pdf/2305.11176.pdf',
        expect.any(Function), // progress callback
        expect.any(Function)  // confirmation callback
      );
    });

    it('should handle large PDFs with context warning', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'A'.repeat(100000), // Large text content
        metadata: {
          pageCount: 200,
          pdfSize: 25.0,
          contextWarning: 'Warning: This is a large PDF that may impact your context window. Consider using smaller page limits.',
          url: 'https://example.com/large-paper.pdf'
        },
        truncated: true
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://example.com/large-paper.pdf',
        maxSizeMB: 50,
        maxPages: 200,
        timeout: 180
      });

      expect(result.success).toBe(true);
      expect(result.text).toBe('A'.repeat(100000));
      expect(result.metadata?.contextWarning).toContain('large PDF');
      expect(result.metadata?.pageCount).toBe(200);
      expect(result.metadata?.textTruncated).toBe(true);
    });

    it('should handle missing optional metadata gracefully', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Minimal metadata test',
        metadata: {
          url: 'https://example.com/minimal.pdf'
        },
        truncated: false
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://example.com/minimal.pdf'
      });

      expect(result.success).toBe(true);
      expect(result.text).toBe('Minimal metadata test');
      expect(result.metadata).toEqual({
        pageCount: undefined,
        sizeBytes: undefined,
        sizeMB: undefined,
        extractionTime: undefined,
        extractionSource: 'pdf',
        textTruncated: false,
        contextWarning: undefined
      });
    });
  });

  describe('User cancellation scenarios', () => {
    it('should handle user cancellation gracefully', async () => {
      const mockResult = {
        extractionSuccess: false,
        metadata: {
          userCancelled: true,
          reason: 'PDF size (75MB) exceeds the configured limit (50MB)',
          sizeMB: 75.0,
          url: 'https://example.com/huge-paper.pdf'
        }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://example.com/huge-paper.pdf',
        maxSizeMB: 50
      });

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.error).toContain('PDF size (75MB) exceeds the configured limit');
    });

    it('should handle cancellation without specific reason', async () => {
      const mockResult = {
        extractionSuccess: false,
        metadata: {
          userCancelled: true,
          url: 'https://example.com/cancelled.pdf'
        }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://example.com/cancelled.pdf'
      });

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.error).toBe('PDF extraction cancelled');
    });
  });

  describe('Extraction failures', () => {
    it('should handle extraction failures without cancellation', async () => {
      const mockResult = {
        extractionSuccess: false,
        metadata: {
          userCancelled: false,
          error: 'Failed to parse PDF: corrupted file',
          url: 'https://example.com/corrupted.pdf'
        }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://example.com/corrupted.pdf'
      });

      expect(result.success).toBe(false);
      expect(result.cancelled).toBeUndefined();
      expect(result.error).toBe('PDF extraction failed');
    });

    it('should handle network errors', async () => {
      mockPdfExtractor.extractText.mockRejectedValue(new Error('Network timeout: Unable to download PDF'));

      const result = await fetchPdfContent({
        url: 'https://example.com/unreachable.pdf'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout: Unable to download PDF');
    });

    it('should handle parsing errors', async () => {
      mockPdfExtractor.extractText.mockRejectedValue(new Error('PDF parsing failed: Invalid PDF structure'));

      const result = await fetchPdfContent({
        url: 'https://example.com/invalid.pdf'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('PDF parsing failed: Invalid PDF structure');
    });

    it('should handle unknown errors', async () => {
      mockPdfExtractor.extractText.mockRejectedValue('Some unknown error');

      const result = await fetchPdfContent({
        url: 'https://example.com/error.pdf'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error during PDF extraction');
    });
  });

  describe('Configuration handling', () => {
    it('should pass correct configuration to PdfExtractor', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Config test',
        metadata: { url: 'https://example.com/test.pdf' }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxSizeMB: 25,
        maxPages: 75,
        timeout: 90,
        confirmLargeFiles: true
      });

      const { PdfExtractor } = await import('../../src/extractors/pdf-extractor.js');
      expect(PdfExtractor).toHaveBeenCalledWith(
        expect.any(Object), // DEFAULT_TEXT_EXTRACTION_CONFIG
        {
          maxSizeMB: 25,
          timeoutMs: 90000, // timeout converted to milliseconds
          maxPages: 75,
          requireConfirmation: true,
          interactive: false // Always false for MCP mode
        }
      );
    });

    it('should always set interactive to false for MCP mode', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Interactive test',
        metadata: { url: 'https://example.com/test.pdf' }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        confirmLargeFiles: true
      });

      const { PdfExtractor } = await import('../../src/extractors/pdf-extractor.js');
      expect(PdfExtractor).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          interactive: false
        })
      );
    });
  });

  describe('Progress and confirmation callbacks', () => {
    it('should provide progress callback to extractor', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Progress test',
        metadata: { url: 'https://example.com/test.pdf' }
      };

      let progressCallback: any;
      mockPdfExtractor.extractText.mockImplementation((url, progress, confirm) => {
        progressCallback = progress;
        return Promise.resolve(mockResult);
      });

      await fetchPdfContent({
        url: 'https://example.com/test.pdf'
      });

      expect(typeof progressCallback).toBe('function');
      
      // Test that progress callback doesn't throw
      expect(() => progressCallback({
        phase: 'downloading',
        progress: 50,
        message: 'Downloading PDF...'
      })).not.toThrow();
    });

    it('should provide auto-confirmation callback that respects size limits', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Confirmation test',
        metadata: { url: 'https://example.com/test.pdf' }
      };

      let confirmationCallback: any;
      mockPdfExtractor.extractText.mockImplementation((url, progress, confirm) => {
        confirmationCallback = confirm;
        return Promise.resolve(mockResult);
      });

      await fetchPdfContent({
        url: 'https://example.com/test.pdf',
        maxSizeMB: 10
      });

      expect(typeof confirmationCallback).toBe('function');
      
      // Test auto-approval for small files
      const smallFileResult = await confirmationCallback({
        url: 'https://example.com/test.pdf',
        sizeMB: 5.0
      });
      expect(smallFileResult).toBe(true);

      // Test auto-rejection for large files
      const largeFileResult = await confirmationCallback({
        url: 'https://example.com/test.pdf',
        sizeMB: 15.0
      });
      expect(largeFileResult).toBe(false);
    });
  });

  describe('Different PDF sources', () => {
    it('should handle arXiv PDFs', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'arXiv paper content about machine learning and neural networks.',
        metadata: {
          pageCount: 12,
          pdfSize: 3.2,
          url: 'https://arxiv.org/pdf/2305.11176.pdf'
        }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://arxiv.org/pdf/2305.11176.pdf'
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('machine learning');
    });

    it('should handle research institution PDFs', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Research paper from university repository about quantum computing.',
        metadata: {
          pageCount: 8,
          pdfSize: 2.1,
          url: 'https://university.edu/papers/quantum-research.pdf'
        }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://university.edu/papers/quantum-research.pdf'
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('quantum computing');
    });

    it('should handle journal publisher PDFs', async () => {
      const mockResult = {
        extractionSuccess: true,
        text: 'Published journal article about climate change research and environmental science.',
        metadata: {
          pageCount: 15,
          pdfSize: 4.8,
          url: 'https://journal.com/articles/climate-research.pdf'
        }
      };

      mockPdfExtractor.extractText.mockResolvedValue(mockResult);

      const result = await fetchPdfContent({
        url: 'https://journal.com/articles/climate-research.pdf'
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('climate change');
    });
  });

  describe('Schema validation', () => {
    it('should validate input schema correctly', () => {
      // Valid input should parse
      const validInput = {
        url: 'https://example.com/test.pdf',
        maxSizeMB: 50,
        maxPages: 100,
        timeout: 120,
        confirmLargeFiles: false
      };

      expect(() => fetchPdfContentSchema.parse(validInput)).not.toThrow();

      // Invalid URL should fail
      expect(() => fetchPdfContentSchema.parse({
        url: 'not-a-url'
      })).toThrow();

      // Out of range values should fail
      expect(() => fetchPdfContentSchema.parse({
        url: 'https://example.com/test.pdf',
        maxSizeMB: 101
      })).toThrow();

      expect(() => fetchPdfContentSchema.parse({
        url: 'https://example.com/test.pdf',
        timeout: 5
      })).toThrow();
    });

    it('should apply default values correctly', () => {
      const input = { url: 'https://example.com/test.pdf' };
      const parsed = fetchPdfContentSchema.parse(input);

      expect(parsed).toEqual({
        url: 'https://example.com/test.pdf',
        maxSizeMB: 50,
        maxPages: 100,
        timeout: 120,
        confirmLargeFiles: false
      });
    });
  });
});