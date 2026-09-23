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
  now = () => new Date(),
} = {}) {
  let queue = Promise.resolve();
  return function appendRejectedTicket(html) {
    // Capture when the log is created, before queue delays or API retries.
    const loggedAt = now().toLocaleString('en-US', {
      timeZone: 'America/New_York', timeZoneName: 'short',
    });
    const operation = queue.then(async () => {
      const token = env.NOTION_TOKEN?.trim();
      const pageId = env.NOTION_PAGE_ID?.trim().replaceAll('-', '');
      if (!token || !/^[a-f\d]{32}$/i.test(pageId || '')) {
        throw new Error('Set NOTION_TOKEN and a valid NOTION_PAGE_ID in .env');
      }

      let insertAfterId = undefined;
      try {
        const topRes = await fetchImpl(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=1`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
          signal: AbortSignal.timeout(10000),
        });
        if (topRes.ok) {
          const topData = await topRes.json();
          if (topData.results && topData.results.length > 0) {
            insertAfterId = topData.results[0].id;
          } else {
            // Page is completely empty. Create the anchor block first.
            const anchorPayload = {
              children: [{
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ type: 'text', text: { content: '🔽 Newest rejected tickets appear below 🔽' }, annotations: { bold: true, color: 'gray' } }]
                }
              }]
            };
            const anchorRes = await fetchImpl(`https://api.notion.com/v1/blocks/${pageId}/children`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
              body: JSON.stringify(anchorPayload),
              signal: AbortSignal.timeout(10000),
            });
            if (anchorRes.ok) {
              const anchorData = await anchorRes.json();
              if (anchorData.results && anchorData.results.length > 0) {
                insertAfterId = anchorData.results[0].id;
              }
            } else {
              await anchorRes.arrayBuffer();
            }
          }
        } else {
          await topRes.arrayBuffer(); // consume body
        }
      } catch (err) {
        // Ignore fetch errors, fallback to appending at the bottom
      }

      const children = rejectionBlocks(`${html}\n🕒 Logged at: ${loggedAt}`);
      for (let offset = 0; offset < children.length; offset += 100) {
        for (let attempt = 0; ; attempt++) {
          const bodyPayload = { children: children.slice(offset, offset + 100) };
          if (insertAfterId) {
            bodyPayload.after = insertAfterId;
          }

          const response = await fetchImpl(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: AbortSignal.timeout(15000),
          });
          if (response.status === 429 && attempt < 2) {
            const seconds = Number(response.headers.get('retry-after')) || 1;
            await response.arrayBuffer();
            await sleep(Math.min(Math.max(seconds, 1), 60) * 1000);
            continue;
          }
          if (!response.ok) {
            throw new Error(`Notion append failed (HTTP ${response.status})`);
          }
          
          const responseData = await response.json();
          if (responseData.results && responseData.results.length > 0) {
            insertAfterId = responseData.results[responseData.results.length - 1].id;
          }
          break;
        }
      }
    });
    queue = operation.catch(() => {});
    return operation;
  };
}

export const appendRejectedTicket = createRejectionWriter();
