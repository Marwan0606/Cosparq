const { openai } = require('../services/openaiService');
const codeResponseModel = require('../models/Code-response')

const codePage = async (req, res) => {
  const userId = req.user.userId
  const { idea, ideaId } = req.body;
  const codeResponse = await codeResponseModel.create({userId, ideaId})
  console.log(codeResponse)

  const messages = [
    {
      role: "system",
      content: `
      recreate this website https://cluely.com/ and also this website https://sintra.ai/?gad_source=1&gad_campaignid=22386630672&gbraid=0AAAAA_NXEDOtqQhqSR4nxL-dK8Frp-88X&gclid=CjwKCAjwt-_FBhBzEiwA7QEqyHcMjWPenzQK1gFRvRbhcmVTjKJ30_LFe0RVWhTOouo1-kQnGcIZvRoC1ggQAvD_BwE in html css and javascript
      
      YOU ARE CREATING A LANDING PAGE FOR THE USER'S IDEA. THE LANDING PAGE SHOULD ALWAYS HAVE A JOIN THE WAITLIST BUTTON.

      Formatting instructions:
      - Return only the fully self-contained HTML file.
      - Wrap your entire output in a single Markdown code block with html at the top and at the bottom.
      - Do not include any explanation or extra text.
      `
    },
    {
      role: "user",
      content: idea
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

    const codeUpdate = await codeResponseModel.findOneAndUpdate({userId, ideaId}, {codeFileResponse:reply, status:'success'}, {
      new: true,
      runValidators: true,
    })
    console.log(codeUpdate)
    
    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
    
  }
};

module.exports = { codePage };
