const { openai } = require('../services/openaiService');

const codeEdit = async (req, res) => {
  const { instructions, originalFile } = req.body;

  const messages = [
    {
      role: "system",
      content: `
        You are given this HTML file with CSS and Javascript too:
        ${originalFile}


        Your task is to apply the user’s instruction and output only the patch in unified-diff (git) format.

Do not reprint any of the original file contents—output nothing but the diff, e.g.:

*** Begin Patch
*** Update File: index.html
@@ -10,7 +10,7 @@
-  background: #0000ff;
+  background: #ff0000;
*** End Patch


Make sure your diff:

Uses normal @@ -start,count +start,count @@ hunk headers

Prefixes removed lines with -, added lines with +, and context lines with a single space

Includes no extra commentary, markdown fences, or wrapping-text just the raw diff.


        Please output *only* a unified-diff patch (git format) that makes the user’s instruction happen:
        > ${instructions}

      `
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages,
      //reasoning_effort:"high"
      //temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
    
  }
};

module.exports = { codeEdit };
