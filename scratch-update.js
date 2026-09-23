import 'dotenv/config';
async function run() {
  const token = process.env.NOTION_TOKEN;
  const blockId = '3dbd26d1-ebf0-81cf-8e0c-e99be8a351dd';
  const payload = {
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '🔽 Newest rejected tickets appear below 🔽' }, annotations: { bold: true, color: 'gray' } }
      ]
    }
  };
  const res = await fetch('https://api.notion.com/v1/blocks/' + blockId, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log(res.status);
}
run();
