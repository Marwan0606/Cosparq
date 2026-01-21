const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');

const codeEditCheap = async (req, res) => {
  const { instructions, originalFile } = req.body;
  const userId = req.user?.userId; // Get userId if available

  const messages = [
    {
      role: "system",
      content: `
        You are given this HTML file with CSS and Javascript too:
        ${originalFile}


        Your task is to apply the user’s instructions modifying the code as needed then outputing the whole full code again with the new changes

        YOU MUST OUPUT THE WHOLE FULL ORIGINALFILE EXACTLY HOW IT IS EXCEPT WITH THE NEW CHANGES AND MODIFICATIONS MADE


Includes no extra commentary, markdown fences, or wrapping text just the whole original file with the new modifications made to it.

Here are the user's instructions
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

    // Track API usage
    if (userId) {
      await trackApiUsage(userId, response, 'codeEditCheap');
    }

    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
    
  }
};

module.exports = { codeEditCheap };
