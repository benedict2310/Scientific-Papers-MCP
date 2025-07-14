import { describe, it, expect, vi, beforeEach } from 'vitest';
import nock from 'nock';
import { searchPapers } from '../../src/tools/search-papers.js';
import { RateLimiter } from '../../src/core/rate-limiter.js';
import { PaperMetadata } from '../../src/types/papers.js';

describe('searchPapers', () => {
  let mockRateLimiter: RateLimiter;

  beforeEach(() => {
    mockRateLimiter = new RateLimiter();
    vi.clearAllMocks();
    nock.cleanAll();
  });

  describe('ArXiv search', () => {
    it('should search papers by title', async () => {
      const mockArxivResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>http://arxiv.org/abs/2401.12345v1</id>
            <title>Machine Learning for Quantum Computing</title>
            <author>
              <name>John Doe</name>
            </author>
            <published>2024-01-15T00:00:00Z</published>
            <link href="http://arxiv.org/abs/2401.12345v1" type="text/html"/>
            <link href="http://arxiv.org/pdf/2401.12345v1.pdf" type="application/pdf"/>
          </entry>
        </feed>
      `;

      nock('http://export.arxiv.org')
        .get('/api/query')
        .query({
          search_query: 'ti:"machine learning"',
          start: 0,
          max_results: 10,
          sortBy: 'relevance',
          sortOrder: 'descending'
        })
        .reply(200, mockArxivResponse);

      const result = await searchPapers({
        source: 'arxiv',
        query: 'machine learning',
        field: 'title',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        id: '2401.12345',
        title: 'Machine Learning for Quantum Computing',
        authors: ['John Doe'],
        date: '2024-01-15',
        pdf_url: 'http://arxiv.org/pdf/2401.12345v1.pdf',
        text: ''
      });
    });

    it('should search papers by author', async () => {
      const mockArxivResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>http://arxiv.org/abs/2401.67890v1</id>
            <title>Deep Learning Applications</title>
            <author>
              <name>Jane Smith</name>
            </author>
            <published>2024-01-20T00:00:00Z</published>
            <link href="http://arxiv.org/abs/2401.67890v1" type="text/html"/>
            <link href="http://arxiv.org/pdf/2401.67890v1.pdf" type="application/pdf"/>
          </entry>
        </feed>
      `;

      nock('http://export.arxiv.org')
        .get('/api/query')
        .query({
          search_query: 'au:"Jane Smith"',
          start: 0,
          max_results: 5,
          sortBy: 'submittedDate',
          sortOrder: 'descending'
        })
        .reply(200, mockArxivResponse);

      const result = await searchPapers({
        source: 'arxiv',
        query: 'Jane Smith',
        field: 'author',
        count: 5,
        sortBy: 'date'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].authors).toContain('Jane Smith');
    });

    it('should handle empty search results', async () => {
      const mockArxivResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
        </feed>
      `;

      nock('http://export.arxiv.org')
        .get('/api/query')
        .query(true)
        .reply(200, mockArxivResponse);

      const result = await searchPapers({
        source: 'arxiv',
        query: 'nonexistent topic',
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      nock('http://export.arxiv.org')
        .get('/api/query')
        .query(true)
        .reply(500, 'Internal Server Error');

      await expect(searchPapers({
        source: 'arxiv',
        query: 'test',
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter)).rejects.toThrow('arXiv API server error');
    });
  });

  describe('OpenAlex search', () => {
    it('should search papers by title', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/W2741809807',
            title: 'Attention Is All You Need',
            display_name: 'Attention Is All You Need',
            publication_date: '2017-12-06',
            doi: '10.1016/j.neucom.2017.06.063',
            authorships: [
              {
                author: {
                  id: 'https://openalex.org/A2208157607',
                  display_name: 'Ashish Vaswani'
                }
              }
            ],
            primary_location: {
              source: { id: 'https://openalex.org/S4210194219', display_name: 'arXiv' },
              landing_page_url: 'https://arxiv.org/abs/1706.03762',
              pdf_url: 'https://arxiv.org/pdf/1706.03762.pdf'
            },
            cited_by_count: 50000,
            concepts: []
          }
        ],
        meta: { count: 1, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'display_name.search:transformer',
          sort: 'relevance_score:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockOpenAlexResponse);

      const result = await searchPapers({
        source: 'openalex',
        query: 'transformer',
        field: 'title',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        id: 'W2741809807',
        title: 'Attention Is All You Need',
        authors: ['Ashish Vaswani'],
        date: '2017-12-06',
        pdf_url: 'https://arxiv.org/pdf/1706.03762.pdf',
        text: ''
      });
    });

    it('should search papers by citations', async () => {
      const mockOpenAlexResponse = {
        results: [
          {
            id: 'https://openalex.org/W2741809807',
            title: 'Highly Cited Paper',
            display_name: 'Highly Cited Paper',
            publication_date: '2020-01-01',
            authorships: [
              {
                author: {
                  id: 'https://openalex.org/A2208157607',
                  display_name: 'Famous Author'
                }
              }
            ],
            primary_location: {
              source: { id: 'https://openalex.org/S4210194219', display_name: 'Journal' },
              landing_page_url: 'https://example.com/paper'
            },
            cited_by_count: 1000,
            concepts: []
          }
        ],
        meta: { count: 1, page: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'search:neural networks',
          sort: 'cited_by_count:desc',
          per_page: 5,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockOpenAlexResponse);

      const result = await searchPapers({
        source: 'openalex',
        query: 'neural networks',
        field: 'all',
        count: 5,
        sortBy: 'citations'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].title).toBe('Highly Cited Paper');
    });

    it('should handle OpenAlex API errors', async () => {
      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(403, 'Forbidden');

      await expect(searchPapers({
        source: 'openalex',
        query: 'test',
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter)).rejects.toThrow('OpenAlex API access forbidden');
    });
  });

  describe('EuropePMC search', () => {
    it('should search papers by title', async () => {
      const mockEuropePMCResponse = {
        hitCount: 1,
        resultList: {
          result: [
            {
              id: '32123456',
              source: 'MED',
              pmid: '32123456',
              title: 'COVID-19 Treatment Strategies',
              authorString: 'Smith J, Johnson M',
              pubYear: '2024',
              journalTitle: 'Medical Journal',
              isOpenAccess: 'Y',
              hasFullText: 'Y',
              citedByCount: 150
            }
          ]
        }
      };

      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: 'TITLE:"COVID-19" AND has_fulltext:y',
          format: 'json',
          pageSize: 10,
          sort: 'relevance',
          resultType: 'core'
        })
        .reply(200, mockEuropePMCResponse);

      const result = await searchPapers({
        source: 'europepmc',
        query: 'COVID-19',
        field: 'title',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        id: '32123456',
        title: 'COVID-19 Treatment Strategies',
        authors: ['Smith J', 'Johnson M'],
        date: '2024-01-01',
        pdf_url: 'https://europepmc.org/article/MED/32123456/pdf',
        text: ''
      });
    });

    it('should search papers by fulltext', async () => {
      const mockEuropePMCResponse = {
        hitCount: 1,
        resultList: {
          result: [
            {
              id: 'PMC7891234',
              source: 'PMC',
              pmcid: 'PMC7891234',
              title: 'Genomic Analysis Methods',
              authorString: 'Brown A, Davis R',
              pubYear: '2023',
              journalTitle: 'Genomics Today',
              isOpenAccess: 'Y',
              hasFullText: 'Y',
              citedByCount: 75
            }
          ]
        }
      };

      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: 'FULL_TEXT:"gene expression" AND has_fulltext:y',
          format: 'json',
          pageSize: 20,
          sort: 'date desc',
          resultType: 'core'
        })
        .reply(200, mockEuropePMCResponse);

      const result = await searchPapers({
        source: 'europepmc',
        query: 'gene expression',
        field: 'fulltext',
        count: 20,
        sortBy: 'date'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].title).toBe('Genomic Analysis Methods');
    });

    it('should handle empty EuropePMC results', async () => {
      const mockEuropePMCResponse = {
        hitCount: 0,
        resultList: {
          result: []
        }
      };

      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query(true)
        .reply(200, mockEuropePMCResponse);

      const result = await searchPapers({
        source: 'europepmc',
        query: 'nonexistent',
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(0);
    });
  });

  describe('CORE search', () => {
    it('should search papers by title', async () => {
      const mockCoreResponse = {
        totalHits: 1,
        results: [
          {
            id: 123456789,
            title: 'Sustainable Energy Solutions',
            authors: [
              { name: 'Green A' },
              { name: 'Solar B' }
            ],
            publishedDate: '2024-03-15',
            yearPublished: 2024,
            doi: '10.1000/example.doi',
            abstract: 'This paper discusses sustainable energy solutions...',
            downloadUrl: 'https://core.ac.uk/download/pdf/123456789.pdf'
          }
        ]
      };

      nock('https://api.core.ac.uk')
        .post('/v3/search/works', {
          q: 'title:"sustainability"',
          limit: 10,
          offset: 0,
          sort: 'relevance',
          exclude_without_fulltext: true
        })
        .reply(200, mockCoreResponse);

      const result = await searchPapers({
        source: 'core',
        query: 'sustainability',
        field: 'title',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        id: '123456789',
        title: 'Sustainable Energy Solutions',
        authors: ['Green A', 'Solar B'],
        date: '2024-03-15',
        pdf_url: 'https://core.ac.uk/download/pdf/123456789.pdf',
        text: ''
      });
    });

    it('should search papers by author', async () => {
      const mockCoreResponse = {
        totalHits: 1,
        results: [
          {
            id: 987654321,
            title: 'Climate Change Research',
            authors: [
              { name: 'Climate Expert' }
            ],
            publishedDate: '2023-12-01',
            yearPublished: 2023,
            abstract: 'Research on climate change impacts...'
          }
        ]
      };

      nock('https://api.core.ac.uk')
        .post('/v3/search/works', {
          q: 'authors:"Climate Expert"',
          limit: 5,
          offset: 0,
          sort: 'publishedDate:desc',
          exclude_without_fulltext: true
        })
        .reply(200, mockCoreResponse);

      const result = await searchPapers({
        source: 'core',
        query: 'Climate Expert',
        field: 'author',
        count: 5,
        sortBy: 'date'
      }, mockRateLimiter);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].authors).toContain('Climate Expert');
    });

    it('should handle CORE API authentication errors', async () => {
      nock('https://api.core.ac.uk')
        .post('/v3/search/works')
        .reply(401, 'Unauthorized');

      await expect(searchPapers({
        source: 'core',
        query: 'test',
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter)).rejects.toThrow('CORE API authentication failed');
    });
  });

  describe('Input validation', () => {
    it('should validate source parameter', async () => {
      await expect(searchPapers({
        source: 'invalid' as any,
        query: 'test',
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter)).rejects.toThrow();
    });

    it('should validate query length', async () => {
      const longQuery = 'a'.repeat(1501);
      await expect(searchPapers({
        source: 'arxiv',
        query: longQuery,
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, mockRateLimiter)).rejects.toThrow();
    });

    it('should validate count parameter', async () => {
      await expect(searchPapers({
        source: 'arxiv',
        query: 'test',
        field: 'all',
        count: 0,
        sortBy: 'relevance'
      }, mockRateLimiter)).rejects.toThrow();

      await expect(searchPapers({
        source: 'arxiv',
        query: 'test',
        field: 'all',
        count: 201,
        sortBy: 'relevance'
      }, mockRateLimiter)).rejects.toThrow();
    });
  });

  describe('Rate limiting', () => {
    it('should handle rate limiting', async () => {
      // Mock rate limiter to return false (rate limited)
      const rateLimitedMock = {
        checkRateLimit: vi.fn().mockReturnValue(false),
        getRetryAfter: vi.fn().mockReturnValue(60)
      } as any;

      await expect(searchPapers({
        source: 'arxiv',
        query: 'test',
        field: 'all',
        count: 10,
        sortBy: 'relevance'
      }, rateLimitedMock)).rejects.toThrow('Rate limited. Retry after 60 seconds');
    });
  });
});