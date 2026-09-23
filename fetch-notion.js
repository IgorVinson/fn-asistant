import 'dotenv/config';
async function fetchBlocks() {
  const token = process.env.NOTION_TOKEN;
  const pageId = process.env.NOTION_PAGE_ID;
  const res = await fetch('https://api.notion.com/v1/blocks/' + pageId + '/children?page_size=100', {
    headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': '2022-06-28' }
  });
  const data = await res.json();
  console.log('Number of blocks:', data.results?.length);
  if (data.results?.length > 0) {
    const lastBlock = data.results[data.results.length - 1];
    console.log('Last block:', JSON.stringify(lastBlock, null, 2));
  }
}
fetchBlocks();
