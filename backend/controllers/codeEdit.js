const { openai } = require('../services/openaiService');

const codeEdit = async (req, res) => {
  const { instructions, originalFile } = req.body;

  const messages = [
    {
      role: "system",
      content: `
        You are given this HTML file with CSS and Javascript too:
        ${originalFile}

        Please output *only* a unified-diff patch (git format) that makes the user’s instruction happen:
        > ${instructions}

        Do not reprint the entire file—just the diff.
      `
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
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
