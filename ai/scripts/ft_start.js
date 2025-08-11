// ai/scripts/ft_start.js
const path = require('path');
require('dotenv').config({
  // load .env from project root no matter where you run the script
  path: path.resolve(__dirname, '../../.env'),
});

const OpenAI = require('openai');
const fs = require('fs');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// build absolute paths relative to this file
const trainPath = path.resolve(__dirname, '../data/scores.train.jsonl');
const validPath = path.resolve(__dirname, '../data/scores.valid.jsonl');

(async () => {
  console.log('Using training file:', trainPath);
  console.log('Using validation file:', validPath);

  const train = await client.files.create({
    file: fs.createReadStream(trainPath),
    purpose: 'fine-tune',
  });

  const valid = await client.files.create({
    file: fs.createReadStream(validPath),
    purpose: 'fine-tune',
  });

  const job = await client.fineTuning.jobs.create({
    model: 'gpt-3.5-turbo-0125',     // make sure this is FT-supported for your account
    training_file: train.id,
    validation_file: valid.id,
    suffix: 'sib-scorer-v1',
  });

  console.log('Job started:', job.id);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
