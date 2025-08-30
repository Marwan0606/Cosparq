const { openai } = require('../services/openaiService');

const codePage = async (req, res) => {
  const { link } = req.body;

  const messages = [
    {
      role: "system",
      content: `
      recreate the website (that the user gives you the link for) in html css and javascript:

      “Can you wrap your HTML/CSS/JS output in Markdown triple-backticks so I can just drop it into my page and have it render nicely?”
      `
    },
    {
      role: "user",
      content: link
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

module.exports = { codePage };
