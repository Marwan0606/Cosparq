// scripts/ft_status.js
require('dotenv').config();
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  const jobs = await client.fineTuning.jobs.list({ limit: 5 });
  console.log(jobs.data.map(j => ({id: j.id, status: j.status, model: j.fine_tuned_model})));

  const jobId = '<your_job_id>'; // from when you started it
  const events = await client.fineTuning.jobs.listEvents(jobId, { limit: 20 });
  console.log(events.data.map(e => ({ level:e.level, message:e.message })));
})();
