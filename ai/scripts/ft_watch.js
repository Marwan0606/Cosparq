require('dotenv').config();
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const jobId = process.argv[2]; // pass the ID printed by ft_start

(async () => {
  let job = await client.fineTuning.jobs.retrieve(jobId);
  console.log('Status:', job.status);

  const timer = setInterval(async () => {
    job = await client.fineTuning.jobs.retrieve(jobId);
    console.log(new Date().toISOString(), job.status);
    if (['succeeded','failed','cancelled'].includes(job.status)) {
      clearInterval(timer);
      console.log('Done. fine_tuned_model:', job.fine_tuned_model);
    }
  }, 8000);
})();
