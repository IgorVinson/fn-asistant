import assert from 'node:assert/strict';
import test from 'node:test';
import { createRejectionWriter, rejectionBlocks } from '../utils/notion/rejectedTickets.js';

const env = { NOTION_TOKEN: 'test-token', NOTION_PAGE_ID: '3dbd26d1-ebf0-809c-983d-dc594abb11f9' };
const response = (status = 200) => Response.json({ results: [{ id: 'anchor' }] }, { status });

test('Notion preserves decoded text, emphasis, links, newlines and long Unicode details', () => {
  const details = 'Reason: ' + '🔧'.repeat(2400);
  const blocks = rejectionBlocks(`<b>❌ REJECTED</b> · <a href="https://example.com/1?a=1&amp;b=2">#1</a>\nPrinter &lt;offline&gt; &amp; cable\n${details}`);
  const richText = blocks.flatMap(block => block.paragraph.rich_text);
  assert.equal(richText.map(part => part.text.content).join(''), `❌ REJECTED · #1\nPrinter <offline> & cable\n${details}`);
  assert.equal(richText[0].annotations.bold, true);
  assert.equal(richText.find(part => part.text.link).text.link.url, 'https://example.com/1?a=1&b=2');
  assert.ok(richText.every(part => part.text.content.length <= 2000));
});

test('writer appends to configured page and retries rate limits', async () => {
  const requests = [];
  const delays = [];
  const writer = createRejectionWriter({ env, sleep: async ms => delays.push(ms),
    now: () => new Date('2026-09-18T18:48:00Z'),
    fetchImpl: async (url, options) => {
      if (options.method === 'GET') return response();
      requests.push({ url, options });
      return requests.length === 1 ? new Response(null, { status: 429, headers: { 'retry-after': '2' } }) : response();
    },
  });
  await writer('<b>❌ REJECTED</b>\nReason: calendar conflict');
  assert.equal(requests.length, 2);
  assert.deepEqual(delays, [2000]);
  assert.equal(requests[0].url, 'https://api.notion.com/v1/blocks/3dbd26d1ebf0809c983ddc594abb11f9/children');
  assert.equal(requests[0].options.method, 'PATCH');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-token');
  assert.match(JSON.stringify(JSON.parse(requests[0].options.body)), /calendar conflict/);
  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.after, 'anchor');
  const text = payload.children.flatMap(block => block.paragraph.rich_text)
    .map(part => part.text.content).join('');
  assert.match(text, /Logged at: 9\/18\/2026, 2:48:00 PM EDT/);
  assert.equal(requests[0].options.body, requests[1].options.body);
});

test('writes are serialized and a failed append does not block the next ticket', async () => {
  let requests = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let currentTime = new Date('2026-01-18T18:48:00Z');
  const bodies = [];
  const writer = createRejectionWriter({ env, now: () => currentTime, fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return response();
    bodies.push(options.body);
    requests++;
    if (requests === 1) { await gate; return response(403); }
    return response();
  } });
  const first = writer('first');
  const failed = assert.rejects(first, /HTTP 403/);
  const second = writer('second');
  currentTime = new Date('2026-01-18T19:00:00Z');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  release();
  await failed;
  await second;
  assert.equal(requests, 2);
  assert.match(bodies[1], /Logged at: 1\/18\/2026, 1:48:00 PM EST/);
});

test('missing configuration fails without making a request or exposing credentials', async () => {
  const writer = createRejectionWriter({ env: {}, fetchImpl: () => assert.fail('Unexpected network call') });
  await assert.rejects(writer('rejected'), /Set NOTION_TOKEN and a valid NOTION_PAGE_ID/);
});
