import assert from 'node:assert/strict';
import test from 'node:test';
import { createTavilyDocumentationSearch } from './src/documentation-search.ts';

test('Tavily search sends an approved-domain-only, bounded request', async () => {
  let init;
  const provider = createTavilyDocumentationSearch({ apiKey: 'test', fetchImpl: async (_url, request) => {
    init = request;
    return new Response(JSON.stringify({ results: [{ title: 'OEM manual', url: 'https://support.example.com/manual.pdf', score: 0.9 }] }), { status: 200 });
  } });
  const results = await provider.search('Example ABC123 service manual', ['example.com']);
  assert.equal(results.length, 1);
  assert.deepEqual(JSON.parse(init.body), { query: 'Example ABC123 service manual', include_domains: ['example.com'], max_results: 5, search_depth: 'basic', include_answer: false, include_raw_content: false });
});

test('Tavily search rejects result URLs outside the approved domains', async () => {
  const provider = createTavilyDocumentationSearch({ apiKey: 'test', fetchImpl: async () => new Response(JSON.stringify({ results: [{ title: 'Wrong', url: 'https://evil.example/manual.pdf' }] }), { status: 200 }) });
  assert.deepEqual(await provider.search('manual', ['example.com']), []);
});

test('Tavily search removes query strings and fragments before returning a candidate', async () => {
  const provider = createTavilyDocumentationSearch({ apiKey: 'test', fetchImpl: async () => new Response(JSON.stringify({ results: [{ title: 'OEM', url: 'https://support.example.com/manual.pdf?temporary=1#page-2' }] }), { status: 200 }) });
  assert.equal((await provider.search('manual', ['example.com']))[0].url, 'https://support.example.com/manual.pdf');
});
