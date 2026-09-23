import 'dotenv/config';
async function run() {
  const token = process.env.NOTION_TOKEN;
  const pageId = process.env.NOTION_PAGE_ID;
  const topRes = await fetch('https://api.notion.com/v1/blocks/' + pageId + '/children?page_size=1', {
    headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': '2022-06-28' }
  });
  const topData = await topRes.json();
  const firstId = topData.results[0].id;
  
  // We can't insert BEFORE a block via API.
  // We have to append a header? No, we can only append at the bottom or after a block.
  // Wait, actually, can we just use a divider or just let the first ticket be the anchor?
}
run();
