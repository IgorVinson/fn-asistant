import 'dotenv/config';
async function fetchBlocks() {
  const token = process.env.NOTION_TOKEN;
  const pageId = process.env.NOTION_PAGE_ID;
  const res = await fetch('https://api.notion.com/v1/blocks/' + pageId + '/children?page_size=3', {
    headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': '2022-06-28' }
  });
  const data = await res.json();
  data.results.forEach((b, i) => {
    console.log('Block', i, b.paragraph?.rich_text.map(rt => rt.plain_text).join(''));
  });
}
fetchBlocks();
