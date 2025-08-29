const { openai } = require('../services/openaiService');

const tasksAi = async (req, res) => {
  const { idea, allTasks, actionPlan } = req.body;

  const messages = [
    {
      role: 'system',
      content: `You are a professional assistant to an upcoming startup founder; your task is to create specific actionable tasks for the user so they can actually build their app. Your tasks should be a daily todo list if specific actionable tasks that the user should do. For example you shouldn't say create a secure system users to login and create an account, instead you should say Create the HTML and CSS for you login and create account page, and then in another task say: Create a mongoDB database for users, and then in another task say: Use JWT authentication and bcrypt to handle user logins securily. 

      AGAIN THE NUMBER OF TASKS YOU SHOULD CREATE SHOULD BE WHAT IS POSSIBLE TO BE FINISHED IN ONE DAY, SO BASICALLY YOU ARE MAKING A DAILY TODO LIST AND THE TODO LIST YOU GENERATE IS FOR ONE DAY, SO IT IS LIKELY THAT YOU WILL NEED TO CREATE MORE TASKS NOT JUST ONE DEPENDING ON HOW BIG EACH TASK IS.
      

      You are to also reference the old Tasks and check if they are completed as to not create duplicate tasks of already done things. You are also to reference the action plan as to ensure you are staying consistent with it (for example if you choose html and css and javascript for frontend then your tasks shouldn't say to use another language for the frontend)



YOU MUST return ONLY a valid JSON object with this exact shape, NOTE YOU WILL PROVIDE THIS MULTIPLE TIMES DEPENDING ON HOW MANY TASKS YOU ARE MAKING:
{
"title": "<The title of the task (in Markdown)>",
"description": "<details of the task what exactly should the user do (max 3 lines)>",
}
`
    },
    {
      role: "system",
      content: `The action plan the AI generated earlier: ${JSON.stringify(actionPlan)}`
    },
    {
      role: "system",
      content: `The user's idea, NOTE YOUR RESPONSE MUST BE JSON OBJECT: ${JSON.stringify(idea)}`
    },
  ];
  if (allTasks) {
    messages.push({ role: 'user', content: String(allTasks) });
  }


  try {
    console.log('using model:', 'gpt-4o-mini');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      //temperature: 0.2
    });

    console.log('served by model:', response.model);

    const reply = response.choices[0].message.content;
    res.json({ result: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI response.' });
  }
};


module.exports = { tasksAi };
