import { describe, it, expect, vi, beforeEach } from 'vitest';
import nock from 'nock';
import { ArxivDriver } from '../../src/drivers/arxiv-driver.js';
import { OpenAlexDriver } from '../../src/drivers/openalex-driver.js';
import { EuropePMCDriver } from '../../src/drivers/europepmc-driver.js';
import { CoreDriver } from '../../src/drivers/core-driver.js';
import { RateLimiter } from '../../src/core/rate-limiter.js';

describe('Driver Search Methods', () => {
  let mockRateLimiter: RateLimiter;

  beforeEach(() => {
    mockRateLimiter = new RateLimiter();
    vi.clearAllMocks();
    nock.cleanAll();
  });

  describe('ArxivDriver', () => {
    let driver: ArxivDriver;

    beforeEach(() => {
      driver = new ArxivDriver(mockRateLimiter);
    });

    it('should build correct search queries for different fields', async () => {
      const mockResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>http://arxiv.org/abs/2401.12345v1</id>
            <title>Test Paper</title>
            <author><name>Test Author</name></author>
            <published>2024-01-15T00:00:00Z</published>
            <link href="http://arxiv.org/abs/2401.12345v1" type="text/html"/>
          </entry>
        </feed>
      `;

      // Test title search
      nock('http://export.arxiv.org')
        .get('/api/query')
        .query({
          search_query: 'ti:"neural networks"',
          start: 0,
          max_results: 10,
          sortBy: 'relevance',
          sortOrder: 'descending'
        })
        .reply(200, mockResponse);

      const titleResult = await driver.searchPapers('neural networks', 'title', 10, 'relevance');
      expect(titleResult).toHaveLength(1);

      // Test author search
      nock('http://export.arxiv.org')
        .get('/api/query')
        .query({
          search_query: 'au:"John Smith"',
          start: 0,
          max_results: 10,
          sortBy: 'relevance',
          sortOrder: 'descending'
        })
        .reply(200, mockResponse);

      const authorResult = await driver.searchPapers('John Smith', 'author', 10, 'relevance');
      expect(authorResult).toHaveLength(1);

      // Test abstract search
      nock('http://export.arxiv.org')
        .get('/api/query')
        .query({
          search_query: 'abs:"machine learning"',
          start: 0,
          max_results: 10,
          sortBy: 'relevance',
          sortOrder: 'descending'
        })
        .reply(200, mockResponse);

      const abstractResult = await driver.searchPapers('machine learning', 'abstract', 10, 'relevance');
      expect(abstractResult).toHaveLength(1);

      // Test all fields search
      nock('http://export.arxiv.org')
        .get('/api/query')
        .query({
          search_query: 'all:"quantum computing"',
          start: 0,
          max_results: 10,
          sortBy: 'relevance',
          sortOrder: 'descending'
        })
        .reply(200, mockResponse);

      const allResult = await driver.searchPapers('quantum computing', 'all', 10, 'relevance');
      expect(allResult).toHaveLength(1);
    });

    it('should handle date sorting correctly', async () => {
      const mockResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>http://arxiv.org/abs/2401.12345v1</id>
            <title>Recent Paper</title>
            <author><name>Recent Author</name></author>
            <published>2024-01-15T00:00:00Z</published>
            <link href="http://arxiv.org/abs/2401.12345v1" type="text/html"/>
          </entry>
        </feed>
      `;

      nock('http://export.arxiv.org')
        .get('/api/query')
        .query({
          search_query: 'all:"test"',
          start: 0,
          max_results: 10,
          sortBy: 'submittedDate',
          sortOrder: 'descending'
        })
        .reply(200, mockResponse);

      const result = await driver.searchPapers('test', 'all', 10, 'date');
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
    });

    it('should handle timeout errors', async () => {
      nock('http://export.arxiv.org')
        .get('/api/query')
        .query(true)
        .replyWithError({ code: 'ECONNABORTED' });

      await expect(driver.searchPapers('test', 'all', 10, 'relevance'))
        .rejects.toThrow('arXiv API request timed out');
    });
  });

  describe('OpenAlexDriver', () => {
    let driver: OpenAlexDriver;

    beforeEach(() => {
      driver = new OpenAlexDriver(mockRateLimiter);
    });

    it('should build correct search queries for different fields', async () => {
      const mockResponse = {
        results: [
          {
            id: 'https://openalex.org/W2741809807',
            title: 'Test Paper',
            display_name: 'Test Paper',
            publication_date: '2024-01-01',
            authorships: [
              { author: { display_name: 'Test Author' } }
            ],
            primary_location: {
              landing_page_url: 'https://example.com/paper'
            },
            cited_by_count: 10,
            concepts: []
          }
        ],
        meta: { count: 1 }
      };

      // Test title search
      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'display_name.search:transformers',
          sort: 'relevance_score:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockResponse);

      const titleResult = await driver.searchPapers('transformers', 'title', 10, 'relevance');
      expect(titleResult).toHaveLength(1);

      // Test author search
      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'authorships.author.display_name.search:Yann LeCun',
          sort: 'relevance_score:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockResponse);

      const authorResult = await driver.searchPapers('Yann LeCun', 'author', 10, 'relevance');
      expect(authorResult).toHaveLength(1);

      // Test abstract search
      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'abstract.search:neural networks',
          sort: 'relevance_score:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockResponse);

      const abstractResult = await driver.searchPapers('neural networks', 'abstract', 10, 'relevance');
      expect(abstractResult).toHaveLength(1);

      // Test fulltext search
      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'fulltext.search:deep learning',
          sort: 'relevance_score:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockResponse);

      const fulltextResult = await driver.searchPapers('deep learning', 'fulltext', 10, 'relevance');
      expect(fulltextResult).toHaveLength(1);
    });

    it('should handle citation sorting', async () => {
      const mockResponse = {
        results: [
          {
            id: 'https://openalex.org/W2741809807',
            title: 'Highly Cited Paper',
            display_name: 'Highly Cited Paper',
            publication_date: '2020-01-01',
            authorships: [
              { author: { display_name: 'Famous Author' } }
            ],
            primary_location: {
              landing_page_url: 'https://example.com/paper'
            },
            cited_by_count: 5000,
            concepts: []
          }
        ],
        meta: { count: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'search:machine learning',
          sort: 'cited_by_count:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockResponse);

      const result = await driver.searchPapers('machine learning', 'all', 10, 'citations');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Highly Cited Paper');
    });

    it('should handle date sorting', async () => {
      const mockResponse = {
        results: [
          {
            id: 'https://openalex.org/W2741809807',
            title: 'Recent Paper',
            display_name: 'Recent Paper',
            publication_date: '2024-01-01',
            authorships: [
              { author: { display_name: 'Recent Author' } }
            ],
            primary_location: {
              landing_page_url: 'https://example.com/paper'
            },
            cited_by_count: 1,
            concepts: []
          }
        ],
        meta: { count: 1 }
      };

      nock('https://api.openalex.org')
        .get('/works')
        .query({
          mailto: 'contact@sciharvestermcp.org',
          filter: 'search:recent research',
          sort: 'publication_date:desc',
          per_page: 10,
          select: 'id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts'
        })
        .reply(200, mockResponse);

      const result = await driver.searchPapers('recent research', 'all', 10, 'date');
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-01');
    });

    it('should handle rate limiting errors', async () => {
      nock('https://api.openalex.org')
        .get('/works')
        .query(true)
        .reply(429, 'Too Many Requests');

      await expect(driver.searchPapers('test', 'all', 10, 'relevance'))
        .rejects.toThrow('Rate limited by OpenAlex API');
    });
  });

  describe('EuropePMCDriver', () => {
    let driver: EuropePMCDriver;

    beforeEach(() => {
      driver = new EuropePMCDriver(mockRateLimiter);
    });

    it('should build correct search queries for different fields', async () => {
      const mockResponse = {
        hitCount: 1,
        resultList: {
          result: [
            {
              id: '32123456',
              source: 'MED',
              pmid: '32123456',
              title: 'Cancer Research Study',
              authorString: 'Smith J, Johnson M',
              pubYear: '2024',
              journalTitle: 'Cancer Journal',
              isOpenAccess: 'Y',
              hasFullText: 'Y',
              citedByCount: 50
            }
          ]
        }
      };

      // Test title search
      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: 'TITLE:"cancer treatment" AND has_fulltext:y',
          format: 'json',
          pageSize: 10,
          sort: 'relevance',
          resultType: 'core'
        })
        .reply(200, mockResponse);

      const titleResult = await driver.searchPapers('cancer treatment', 'title', 10, 'relevance');
      expect(titleResult).toHaveLength(1);

      // Test author search
      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: 'AUTH:"Smith J" AND has_fulltext:y',
          format: 'json',
          pageSize: 10,
          sort: 'relevance',
          resultType: 'core'
        })
        .reply(200, mockResponse);

      const authorResult = await driver.searchPapers('Smith J', 'author', 10, 'relevance');
      expect(authorResult).toHaveLength(1);

      // Test abstract search
      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: 'ABSTRACT:"immunotherapy" AND has_fulltext:y',
          format: 'json',
          pageSize: 10,
          sort: 'relevance',
          resultType: 'core'
        })
        .reply(200, mockResponse);

      const abstractResult = await driver.searchPapers('immunotherapy', 'abstract', 10, 'relevance');
      expect(abstractResult).toHaveLength(1);

      // Test fulltext search
      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: 'FULL_TEXT:"gene therapy" AND has_fulltext:y',
          format: 'json',
          pageSize: 10,
          sort: 'relevance',
          resultType: 'core'
        })
        .reply(200, mockResponse);

      const fulltextResult = await driver.searchPapers('gene therapy', 'fulltext', 10, 'relevance');
      expect(fulltextResult).toHaveLength(1);
    });

    it('should handle citation sorting', async () => {
      const mockResponse = {
        hitCount: 1,
        resultList: {
          result: [
            {
              id: 'PMC7891234',
              source: 'PMC',
              pmcid: 'PMC7891234',
              title: 'Highly Cited Medical Paper',
              authorString: 'Expert A, Researcher B',
              pubYear: '2023',
              journalTitle: 'Top Medical Journal',
              isOpenAccess: 'Y',
              hasFullText: 'Y',
              citedByCount: 1000
            }
          ]
        }
      };

      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: '"medical research" AND has_fulltext:y',
          format: 'json',
          pageSize: 10,
          sort: 'citedby desc',
          resultType: 'core'
        })
        .reply(200, mockResponse);

      const result = await driver.searchPapers('medical research', 'all', 10, 'citations');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Highly Cited Medical Paper');
    });

    it('should handle date sorting', async () => {
      const mockResponse = {
        hitCount: 1,
        resultList: {
          result: [
            {
              id: 'PMC8001234',
              source: 'PMC',
              pmcid: 'PMC8001234',
              title: 'Recent Medical Study',
              authorString: 'New A, Latest B',
              pubYear: '2024',
              journalTitle: 'Current Medical Journal',
              isOpenAccess: 'Y',
              hasFullText: 'Y',
              citedByCount: 5
            }
          ]
        }
      };

      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query({
          query: '"recent study" AND has_fulltext:y',
          format: 'json',
          pageSize: 10,
          sort: 'date desc',
          resultType: 'core'
        })
        .reply(200, mockResponse);

      const result = await driver.searchPapers('recent study', 'all', 10, 'date');
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-01');
    });

    it('should handle server errors', async () => {
      nock('https://www.ebi.ac.uk')
        .get('/europepmc/webservices/rest/search')
        .query(true)
        .reply(500, 'Internal Server Error');

      await expect(driver.searchPapers('test', 'all', 10, 'relevance'))
        .rejects.toThrow('Europe PMC API server error');
    });
  });

  describe('CoreDriver', () => {
    let driver: CoreDriver;

    beforeEach(() => {
      driver = new CoreDriver(mockRateLimiter);
    });

    it('should build correct search queries for different fields', async () => {
      const mockResponse = {
        totalHits: 1,
        results: [
          {
            id: 123456789,
            title: 'Environmental Science Study',
            authors: [
              { name: 'Green A' },
              { name: 'Sustainable B' }
            ],
            publishedDate: '2024-02-15',
            yearPublished: 2024,
            doi: '10.1000/environment.2024.001',
            abstract: 'This study examines environmental sustainability...',
            downloadUrl: 'https://core.ac.uk/download/pdf/123456789.pdf'
          }
        ]
      };

      // Test title search
      nock('https://api.core.ac.uk')
        .post('/v3/search/works', {
          q: 'title:"environmental science"',
          limit: 10,
          offset: 0,
          sort: 'relevance',
          exclude_without_fulltext: true
        })
        .reply(200, mockResponse);

      const titleResult = await driver.searchPapers('environmental science', 'title', 10, 'relevance');
      expect(titleResult).toHaveLength(1);

      // Test author search
      nock('https://api.core.ac.uk')
        .post('/v3/search/works', {
          q: 'authors:"Green A"',
          limit: 10,
          offset: 0,
          sort: 'relevance',
          exclude_without_fulltext: true
        })
        .reply(200, mockResponse);

      const authorResult = await driver.searchPapers('Green A', 'author', 10, 'relevance');
      expect(authorResult).toHaveLength(1);

      // Test abstract search
      nock('https://api.core.ac.uk')
        .post('/v3/search/works', {
          q: 'abstract:"sustainability"',
          limit: 10,
          offset: 0,
          sort: 'relevance',
          exclude_without_fulltext: true
        })
        .reply(200, mockResponse);

      const abstractResult = await driver.searchPapers('sustainability', 'abstract', 10, 'relevance');
      expect(abstractResult).toHaveLength(1);

      // Test fulltext search
      nock('https://api.core.ac.uk')
        .post('/v3/search/works', {
          q: 'fullText:"climate change"',
          limit: 10,
          offset: 0,
          sort: 'relevance',
          exclude_without_fulltext: true
        })
        .reply(200, mockResponse);

      const fulltextResult = await driver.searchPapers('climate change', 'fulltext', 10, 'relevance');
      expect(fulltextResult).toHaveLength(1);
    });

    it('should handle date sorting', async () => {
      const mockResponse = {
        totalHits: 1,
        results: [
          {
            id: 987654321,
            title: 'Recent Research Paper',
            authors: [
              { name: 'Recent Author' }
            ],
            publishedDate: '2024-03-01',
            yearPublished: 2024,
            abstract: 'This is recent research...'
          }
        ]
      };

      nock('https://api.core.ac.uk')
        .post('/v3/search/works', {
          q: '"recent research"',
          limit: 10,
          offset: 0,
          sort: 'publishedDate:desc',
          exclude_without_fulltext: true
        })
        .reply(200, mockResponse);

      const result = await driver.searchPapers('recent research', 'all', 10, 'date');
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-03-01');
    });

    it('should handle authentication errors', async () => {
      nock('https://api.core.ac.uk')
        .post('/v3/search/works')
        .reply(401, 'Unauthorized');

      await expect(driver.searchPapers('test', 'all', 10, 'relevance'))
        .rejects.toThrow('CORE API authentication failed');
    });

    it('should handle rate limiting', async () => {
      nock('https://api.core.ac.uk')
        .post('/v3/search/works')
        .reply(429, 'Too Many Requests');

      await expect(driver.searchPapers('test', 'all', 10, 'relevance'))
        .rejects.toThrow('Rate limited by CORE API');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits across all drivers', async () => {
      const rateLimitedMock = {
        checkRateLimit: vi.fn().mockReturnValue(false),
        getRetryAfter: vi.fn().mockReturnValue(30)
      } as any;

      const drivers = [
        new ArxivDriver(rateLimitedMock),
        new OpenAlexDriver(rateLimitedMock),
        new EuropePMCDriver(rateLimitedMock),
        new CoreDriver(rateLimitedMock)
      ];

      for (const driver of drivers) {
        await expect(driver.searchPapers('test', 'all', 10, 'relevance'))
          .rejects.toThrow('Rate limited. Retry after 30 seconds');
      }
    });
  });
});