import { describe, it, expect, vi, beforeEach } from 'vitest';
import nock from 'nock';
import { fetchTopCited } from '../../src/tools/fetch-top-cited.js';
import { RateLimiter } from '../../src/core/rate-limiter.js';

describe('fetchTopCited', () => {
  let mockRateLimiter: RateLimiter;

  beforeEach(() => {
    mockRateLimiter = new RateLimiter();
    vi.clearAllMocks();
    nock.cleanAll();
  });

  describe('OpenAlex integration', () => {
    it('should fetch top cited papers for a concept', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/W2741809807',
            title: 'Attention Is All You Need',
            display_name: 'Attention Is All You Need',
            publication_date: '2017-12-06',
            doi: '10.48550/arXiv.1706.03762',
            authorships: [
              {
                author: {
                  id: 'https://openalex.org/A2208157607',
                  display_name: 'Ashish Vaswani'
                }
              },
              {
                author: {
                  id: 'https://openalex.org/A2123456789',
                  display_name: 'Noam Shazeer'
                }
              }
            ],
            primary_location: {
              source: { id: 'https://openalex.org/S4210194219', display_name: 'arXiv' },
              landing_page_url: 'https://arxiv.org/abs/1706.03762',
              pdf_url: 'https://arxiv.org/pdf/1706.03762.pdf'
            },
            best_oa_location: {
              pdf_url: 'https://arxiv.org/pdf/1706.03762.pdf'
            },
            cited_by_count: 50000,
            concepts: [
              {
                id: 'https://openalex.org/C41008148',
                display_name: 'Machine learning',
                level: 1,
                score: 0.85
              }
            ]
          },
          {
            id: 'https://openalex.org/W2963650142',
            title: 'BERT: Pre-training of Deep Bidirectional Transformers',
            display_name: 'BERT: Pre-training of Deep Bidirectional Transformers',
            publication_date: '2018-10-11',
            doi: '10.48550/arXiv.1810.04805',
            authorships: [
              {
                author: {
                  id: 'https://openalex.org/A2135463152',
                  display_name: 'Jacob Devlin'
                }
              }
            ],
            primary_location: {
              source: { id: 'https://openalex.org/S4210194219', display_name: 'arXiv' },
              landing_page_url: 'https://arxiv.org/abs/1810.04805',
              pdf_url: 'https://arxiv.org/pdf/1810.04805.pdf'
            },
            cited_by_count: 35000,
            concepts: [
              {
                id: 'https://openalex.org/C41008148',
                display_name: 'Machine learning',
                level: 1,
                score: 0.90
              }
            ]
          }
        ],
        meta: { count: 2, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'concepts.display_name.search:machine learning,publication_date:>2024-01-01',
          sort: 'cited_by_count:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockOpenAlexResponse);

      const result = await fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: 10
      }, mockRateLimiter);

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        id: 'W2741809807',
        title: 'Attention Is All You Need',
        authors: ['Ashish Vaswani', 'Noam Shazeer'],
        date: '2017-12-06',
        pdf_url: 'https://arxiv.org/pdf/1706.03762.pdf',
        text: ''
      });
      expect(result.content[1]).toEqual({
        id: 'W2963650142',
        title: 'BERT: Pre-training of Deep Bidirectional Transformers',
        authors: ['Jacob Devlin'],
        date: '2018-10-11',
        pdf_url: 'https://arxiv.org/pdf/1810.04805.pdf',
        text: ''
      });
    });

    it('should handle concept ID format', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/W123456789',
            title: 'Test Paper',
            display_name: 'Test Paper',
            publication_date: '2024-01-15',
            authorships: [
              {
                author: {
                  display_name: 'Test Author'
                }
              }
            ],
            primary_location: {
              source: { display_name: 'Test Journal' }
            },
            cited_by_count: 100,
            concepts: []
          }
        ],
        meta: { count: 1, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'concepts.id:https://openalex.org/C41008148,publication_date:>2023-01-01',
          sort: 'cited_by_count:desc',
          per_page: 5,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockOpenAlexResponse);

      const result = await fetchTopCited({
        concept: 'C41008148',
        since: '2023-01-01',
        count: 5
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].id).toBe('W123456789');
    });

    it('should handle empty results', async () => {
      const mockOpenAlexResponse = {
        results: [],
        meta: { count: 0, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(200, mockOpenAlexResponse);

      const result = await fetchTopCited({
        concept: 'nonexistent concept',
        since: '2024-01-01',
        count: 10
      }, mockRateLimiter);

      expect(result.content).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(500, 'Internal Server Error');

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: 10
      }, mockRateLimiter)).rejects.toThrow('OpenAlex API server error');
    });

    it('should handle rate limiting errors', async () => {
      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(429, 'Too Many Requests');

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: 10
      }, mockRateLimiter)).rejects.toThrow('Rate limited by OpenAlex API');
    });

    it('should handle authentication errors', async () => {
      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(403, 'Forbidden');

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: 10
      }, mockRateLimiter)).rejects.toThrow('OpenAlex API access forbidden');
    });
  });

  describe('Input validation', () => {
    it('should validate concept parameter', async () => {
      await expect(fetchTopCited({
        concept: '',
        since: '2024-01-01',
        count: 10
      }, mockRateLimiter)).rejects.toThrow();
    });

    it('should validate date format', async () => {
      await expect(fetchTopCited({
        concept: 'machine learning',
        since: 'invalid-date',
        count: 10
      }, mockRateLimiter)).rejects.toThrow();

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024/01/01',
        count: 10
      }, mockRateLimiter)).rejects.toThrow();

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '24-01-01',
        count: 10
      }, mockRateLimiter)).rejects.toThrow();
    });

    it('should validate count parameter', async () => {
      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: 0
      }, mockRateLimiter)).rejects.toThrow();

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: 201
      }, mockRateLimiter)).rejects.toThrow();

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: -5
      }, mockRateLimiter)).rejects.toThrow();
    });
  });

  describe('Date range handling', () => {
    it('should handle recent date ranges', async () => {
      const mockOpenAlexResponse = {
        results: [],
        meta: { count: 0, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'concepts.display_name.search:quantum computing,publication_date:>2024-06-01',
          sort: 'cited_by_count:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockOpenAlexResponse);

      const result = await fetchTopCited({
        concept: 'quantum computing',
        since: '2024-06-01',
        count: 10
      }, mockRateLimiter);

      expect(result.content).toHaveLength(0);
    });

    it('should handle historical date ranges', async () => {
      const mockOpenAlexResponse = {
        results: [],
        meta: { count: 0, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'concepts.display_name.search:artificial intelligence,publication_date:>2020-01-01',
          sort: 'cited_by_count:desc',
          per_page: 50,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockOpenAlexResponse);

      const result = await fetchTopCited({
        concept: 'artificial intelligence',
        since: '2020-01-01',
        count: 50
      }, mockRateLimiter);

      expect(result.content).toHaveLength(0);
    });
  });

  describe('Rate limiting', () => {
    it('should handle rate limiting', async () => {
      // Mock rate limiter to return false (rate limited)
      const rateLimitedMock = {
        checkRateLimit: vi.fn().mockReturnValue(false),
        getRetryAfter: vi.fn().mockReturnValue(60)
      } as any;

      await expect(fetchTopCited({
        concept: 'machine learning',
        since: '2024-01-01',
        count: 10
      }, rateLimitedMock)).rejects.toThrow('Rate limited. Retry after 60 seconds');
    });
  });

  describe('Response formatting', () => {
    it('should correctly extract OpenAlex Work IDs', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/W1234567890',
            title: 'Test Paper',
            display_name: 'Test Paper',
            publication_date: '2024-01-01',
            authorships: [],
            primary_location: { source: { display_name: 'Test' } },
            cited_by_count: 10,
            concepts: []
          }
        ],
        meta: { count: 1, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(200, mockOpenAlexResponse);

      const result = await fetchTopCited({
        concept: 'test',
        since: '2024-01-01',
        count: 1
      }, mockRateLimiter);

      expect(result.content[0].id).toBe('W1234567890');
    });

    it('should handle missing PDF URLs gracefully', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/W1234567890',
            title: 'Test Paper',
            display_name: 'Test Paper',
            publication_date: '2024-01-01',
            authorships: [],
            primary_location: { source: { display_name: 'Test' } },
            cited_by_count: 10,
            concepts: []
          }
        ],
        meta: { count: 1, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(200, mockOpenAlexResponse);

      const result = await fetchTopCited({
        concept: 'test',
        since: '2024-01-01',
        count: 1
      }, mockRateLimiter);

      expect(result.content[0].pdf_url).toBeUndefined();
    });
  });
});