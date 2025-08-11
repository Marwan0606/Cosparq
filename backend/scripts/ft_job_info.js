// backend/scripts/ft_job_info.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  // List recent jobs so we can find the one that produced your model
  const jobs = await client.fineTuning.jobs.list({ limit: 10 });
  const targetModel = process.env.SIB_SCORER_MODEL;

  // Try to find the job that created this FT model
  const job = jobs.data.find(j => j.fine_tuned_model === targetModel);
  if (!job) {
    console.log('Could not find job for model:', targetModel);
    console.log('Recent jobs:', jobs.data.map(j => ({
      id: j.id, status: j.status, model: j.fine_tuned_model, suffix: j.suffix
    })));
    process.exit(1);
  }

  console.log('Job ID:', job.id);
  console.log('Status:', job.status);
  console.log('Base model:', job.model);
  console.log('Suffix:', job.suffix);
  console.log('Training file ID:', job.training_file);
  console.log('Validation file ID:', job.validation_file);

  // Show a few training events so you can see if steps actually ran
  const events = await client.fineTuning.jobs.listEvents(job.id, { limit: 20 });
  console.log('\nRecent training events:');
  events.data.forEach(e => console.log(`[${e.created_at}] ${e.level}: ${e.message}`));
})();
