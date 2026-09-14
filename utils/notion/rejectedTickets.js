import 'dotenv/config';
import { load } from 'cheerio';
import https from 'node:https';
import tls from 'node:tls';

// Include the OS trust store for locally trusted certificate authorities,
// without disabling certificate validation or changing other platform clients.
const notionAgent = new https.Agent({
  ca: [...(tls.getCACertificates?.('default') || tls.rootCertificates),
    ...(tls.getCACertificates?.('system') || [])],
});

function notionFetch(url, { body, ...options }) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { ...options, agent: notionAgent }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode,
        headers: new Headers(Object.entries(response.headers)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value])),
      })));
    });
    request.on('error', reject);
    request.end(body);
  });
}

// Reuse the rendered Telegram message, preserving text, emphasis and ticket links.
export function rejectionBlocks(html) {
  const $ = load(html, null, false);
  const richText = [];
  function visit(node, annotations = {}, link = null) {
    if (node.type === 'text') {
      // Stay below Notion's 2,000-character limit, including surrogate pairs.
      const characters = Array.from(node.data);
      for (let i = 0; i < characters.length; i += 1000) {
        richText.push({ type: 'text', text: {
          content: characters.slice(i, i + 1000).join(''),
          ...(link ? { link: { url: link } } : {}),
        }, annotations });
      }
      return;
    }
    const style = { ...annotations };
    if (node.name === 'b') style.bold = true;
    if (node.name === 'i') style.italic = true;
    const href = node.name === 'a' ? $(node).attr('href') : link;
    for (const child of node.children || []) visit(child, style, href);
  }
  for (const node of $.root().contents().toArray()) visit(node);
  const blocks = [];
  for (let i = 0; i < richText.length; i += 100) {
    blocks.push({ object: 'block', type: 'paragraph',
      paragraph: { rich_text: richText.slice(i, i + 100) } });
  }
  return blocks;
}

export function createRejectionWriter({
  env = process.env,
  fetchImpl = notionFetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  let queue = Promise.resolve();
  return function appendRejectedTicket(html) {
    const operation = queue.then(async () => {
      const token = env.NOTION_TOKEN?.trim();
      const pageId = env.NOTION_PAGE_ID?.trim().replaceAll('-', '');
      if (!token || !/^[a-f\d]{32}$/i.test(pageId || '')) {
        throw new Error('Set NOTION_TOKEN and a valid NOTION_PAGE_ID in .env');
      }
      const children = rejectionBlocks(html);
      for (let offset = 0; offset < children.length; offset += 100) {
        for (let attempt = 0; ; attempt++) {
          const response = await fetchImpl(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json' },
            body: JSON.stringify({ children: children.slice(offset, offset + 100) }),
            signal: AbortSignal.timeout(15000),
          });
          if (response.status === 429 && attempt < 2) {
            const seconds = Number(response.headers.get('retry-after')) || 1;
            await response.arrayBuffer();
            await sleep(Math.min(Math.max(seconds, 1), 60) * 1000);
            continue;
          }
          if (!response.ok) {
            // Do not log API response bodies or credentials. Ambiguous failures
            // are not retried automatically, which could duplicate an append.
            throw new Error(`Notion append failed (HTTP ${response.status})`);
          }
          await response.arrayBuffer();
          break;
        }
      }
    });
    // A failed write must not block subsequent tickets.
    queue = operation.catch(() => {});
    return operation;
  };
}

export const appendRejectedTicket = createRejectionWriter();
