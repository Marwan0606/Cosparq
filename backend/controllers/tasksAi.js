const { openai } = require('../services/openaiService');

const actionPlan = async (req, res) => {
  const { idea } = req.body;

  const messages = [
    {
      role: "system",
      content: `
      
      `
    },
    {
      role: "user",
      content: idea
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      //temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
    
  }
};

module.exports = { actionPlan };
