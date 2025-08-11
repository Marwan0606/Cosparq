// backend/scripts/ft_cat_file.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fileId = process.argv[2];
if (!fileId) {
  console.error('Usage: node scripts/ft_cat_file.js <file_id>');
  process.exit(1);
}

(async () => {
  const file = await client.files.retrieve(fileId);
  console.log('File:', file);
  const stream = await client.files.content(fileId);
  const buf = await stream.arrayBuffer();
  const txt = Buffer.from(buf).toString('utf8');
  console.log('\nFirst 10 lines:\n');
  txt.split(/\r?\n/).slice(0,10).forEach((l,i)=>console.log(i+1, l));
})();
