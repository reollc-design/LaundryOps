export interface DocumentationSearchResult { title: string; url: string; score: number | null; }
export interface DocumentationSearchProvider { search(query: string, allowedDomains: string[]): Promise<DocumentationSearchResult[]>; }
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function allowedUrl(value: unknown, domains: string[]): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (!domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

export function createTavilyDocumentationSearch(params: { apiKey: string; fetchImpl?: FetchLike; timeoutMs?: number }): DocumentationSearchProvider {
  const fetchImpl = params.fetchImpl ?? fetch;
  const timeoutMs = params.timeoutMs ?? 10_000;
  return {
    async search(query, allowedDomains) {
      if (!params.apiKey.trim()) throw new Error('Documentation search provider is not configured.');
      if (allowedDomains.length === 0) throw new Error('No approved documentation source domains are configured.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl('https://api.tavily.com/search', {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, include_domains: allowedDomains, max_results: 5, search_depth: 'basic', include_answer: false, include_raw_content: false }),
        });
        if (!response.ok) throw new Error(`Documentation search provider returned HTTP ${response.status}.`);
        const body = await response.json() as { results?: unknown };
        if (!Array.isArray(body.results)) return [];
        return body.results.flatMap((result) => {
          const record = typeof result === 'object' && result !== null ? result as Record<string, unknown> : {};
          const url = allowedUrl(record.url, allowedDomains.map((value) => value.toLowerCase()));
          if (!url) return [];
          return [{ title: typeof record.title === 'string' ? record.title.slice(0, 500) : 'Untitled candidate', url,
            score: typeof record.score === 'number' && Number.isFinite(record.score) ? record.score : null }];
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Documentation search timed out.');
        throw error;
      } finally { clearTimeout(timer); }
    },
  };
}
