const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const { maxLength, ensureString } = require('../middleware/sanitize');

/**
 * Sync idea with AI - analyzes chat logs and market research to update the idea
 * Based on the renewIdea pattern but with no-hallucination safeguards
 */
const syncIdeaWithAI = async (req, res) => {
  try {
    const userId = req.user.userId;
    const ideaId = ensureString(req.body.ideaId);
    const oldIdea = maxLength(ensureString(req.body.oldIdea), 10000);
    const chatLogs = maxLength(ensureString(req.body.chatLogs), 50000);
    const marketData = maxLength(ensureString(req.body.marketData), 50000);

    if (!oldIdea) {
      return res.status(400).json({ error: 'Old idea is required' });
    }

    // Check if there's any context to work with
    const hasContext = (chatLogs && chatLogs.trim().length > 0) || (marketData && marketData.trim().length > 0);

    if (!hasContext) {
      return res.json({ 
        noChanges: true, 
        message: 'No conversations or research found to sync from. Start chatting with AI or do market research first!' 
      });
    }

    const messages = [
      {
        role: "system",
        content: `You are an assistant that helps refine startup ideas based on user conversations and research.

CRITICAL RULES:
1. ONLY incorporate changes that are EXPLICITLY discussed in the chat logs or market research
2. DO NOT add features, capabilities, or details that weren't mentioned
3. If there are minimal or no meaningful changes to make, respond with {"noChanges": true}
4. Keep the core essence of the original idea - just refine and clarify based on actual discussions
5. If discussions contradict the original idea, note that but don't completely change direction

You must return ONLY a valid JSON object with NO markdown, NO code blocks, NO extra text.

If meaningful updates exist, return:
{
  "newIdea": "<the updated idea incorporating discussed changes>",
  "changeSummary": "<brief 1-2 sentence summary of what changed>"
}

If no meaningful changes needed, return:
{
  "noChanges": true
}`
      },
      {
        role: "user",
        content: `### CURRENT IDEA
${oldIdea}

### CHAT CONVERSATIONS & CO-FOUNDER MEETINGS (if any)
${chatLogs || 'No chat conversations yet'}

### MARKET RESEARCH (if any)
${marketData || 'No market research yet'}

Based on the conversations, co-founder meetings, and research above, should the idea be updated? Remember: ONLY make changes if they were actually discussed. Don't hallucinate new features.`
      },
    ];

    console.log('Idea Hub Sync - using model: gpt-4o-mini');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3, // Lower temperature for more consistent output
    });

    // Track API usage
    await trackApiUsage(userId, response, 'ideaHubSync');

    const reply = response.choices[0].message.content;
    console.log('AI Response:', reply);

    // Parse the response
    let result;
    try {
      // Clean up potential markdown formatting
      let cleanReply = reply.trim();
      if (cleanReply.startsWith('```json')) {
        cleanReply = cleanReply.slice(7);
      }
      if (cleanReply.startsWith('```')) {
        cleanReply = cleanReply.slice(3);
      }
      if (cleanReply.endsWith('```')) {
        cleanReply = cleanReply.slice(0, -3);
      }
      result = JSON.parse(cleanReply.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return res.status(500).json({ error: 'AI returned invalid response format' });
    }

    if (result.noChanges) {
      return res.json({ 
        noChanges: true, 
        message: 'Your idea is already up to date based on your conversations!' 
      });
    }

    res.json({
      newIdea: result.newIdea,
      changeSummary: result.changeSummary || 'Updated based on recent conversations'
    });

  } catch (error) {
    console.error('Idea Hub Sync error:', error);
    res.status(500).json({ error: 'Failed to sync idea with AI' });
  }
};

/**
 * Generate a summary from all DNA sections using AI.
 * The summary is stored in the `idea` field for backward compatibility.
 */
const generateDnaSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      vision,
      coreProblem,
      targetAudience,
      revenueModel,
      competitiveLandscape,
      mvpScope,
      brandIdentity,
      techStack,
      progressStage,
      progressNotes,
      ideaName,
    } = req.body;

    // Build DNA context string from all sections
    const sections = [];
    if (ideaName) sections.push(`Idea Name: ${ideaName}`);
    if (vision) sections.push(`Vision & Purpose: ${vision}`);
    if (coreProblem) sections.push(`Core Problem: ${coreProblem}`);
    if (targetAudience) sections.push(`Target Audience: ${targetAudience}`);
    if (revenueModel) sections.push(`Revenue Model: ${revenueModel}`);
    if (competitiveLandscape) sections.push(`Competitive Landscape: ${competitiveLandscape}`);
    if (mvpScope) sections.push(`MVP Scope: ${mvpScope}`);
    if (brandIdentity) {
      const parts = [];
      if (brandIdentity.description) parts.push(brandIdentity.description);
      if (brandIdentity.colors?.length) parts.push(`Colors: ${brandIdentity.colors.join(', ')}`);
      if (brandIdentity.fonts?.length) parts.push(`Fonts: ${brandIdentity.fonts.join(', ')}`);
      if (parts.length) sections.push(`Brand & Identity: ${parts.join('. ')}`);
    }
    if (techStack) {
      const parts = [];
      if (techStack.tags?.length) parts.push(`Technologies: ${techStack.tags.join(', ')}`);
      if (techStack.notes) parts.push(techStack.notes);
      if (parts.length) sections.push(`Tech Stack: ${parts.join('. ')}`);
    }
    if (progressStage) sections.push(`Current Stage: ${progressStage}`);
    if (progressNotes) sections.push(`Progress Notes: ${progressNotes}`);

    if (sections.length === 0) {
      return res.status(400).json({ error: 'At least one DNA section must be filled in to generate a summary.' });
    }

    const dnaContent = sections.join('\n\n');

    const messages = [
      {
        role: 'system',
        content: `You are a startup idea summarization expert. Your job is to take structured information about a startup idea and produce a clear, detailed, and comprehensive summary.

RULES:
1. The summary MUST be a maximum of 600 words
2. Include ALL important details: the concept, the vision, the problem it solves, the target audience, the revenue model, technology, brand identity, and current progress — weave them into one cohesive narrative
3. Write in a clear, professional third-person style
4. Do NOT add information that is not in the provided sections — only summarize what is given
5. Make the summary flow naturally as one cohesive description, not a list of bullet points
6. Prioritize clarity — someone reading ONLY this summary should fully understand the entire startup
7. This summary serves as the single source of truth for the idea — it must be comprehensive enough that every other section is represented

Return ONLY the summary text. No headings, no bullet points, no markdown formatting, no extra commentary.`,
      },
      {
        role: 'user',
        content: `Here are all the DNA sections for this startup idea. Please create a comprehensive summary (max 600 words):\n\n${dnaContent}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 1200,
    });

    await trackApiUsage(userId, response, 'dnaSummaryGeneration');

    const summary = response.choices[0].message.content.trim();

    res.json({ summary });
  } catch (error) {
    console.error('DNA Summary generation error:', error);
    res.status(500).json({ error: 'Failed to generate DNA summary' });
  }
};

/**
 * AI Co-Founder Interview — multi-turn conversation to understand an idea,
 * then auto-fill all DNA sections when enough info is gathered.
 */
const interviewChat = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Sanitize messages
    const cleanMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: maxLength(ensureString(m.content), 8000),
    }));

    // Guard: if this is the FIRST user message and it's too short / clearly not a real idea, reject early
    const userMessages = cleanMessages.filter(m => m.role === 'user');
    if (userMessages.length === 1) {
      const firstMsg = userMessages[0].content.replace(/[^a-zA-Z0-9]/g, '').trim();
      if (firstMsg.length < 5) {
        return res.json({
          type: 'question',
          message: "Hmm, it looks like you haven't described an idea yet! Tell me about the startup or product you're thinking of — even a rough sentence is enough to get started. What problem are you trying to solve?"
        });
      }
    }

    const systemPrompt = `You are an expert startup co-founder conducting a quick interview to deeply understand a new startup idea. You are friendly, sharp, and efficient.

YOUR GOAL: Understand this idea well enough to fill out ALL sections of the startup's "DNA board" with RICH, DETAILED, HIGH-QUALITY content. Each section should read like it was written by an experienced startup advisor. Do NOT write short generic sentences — every section must be specific to THIS idea.

SECTION REQUIREMENTS (with MINIMUM word counts):

1. **The Idea** (idea) — 400-600 words MINIMUM. A comprehensive, flowing narrative that covers the full picture: what it is, who it's for, the problem, the solution approach, the vision, the revenue strategy, technology choices, and brand feel. Written in professional third-person prose. Someone reading ONLY this section should completely understand the startup.

2. **Target Audience** (targetAudience) — 100-200 words MINIMUM. Describe 2-3 specific user personas with demographics, psychographics, behaviors, and pain points. Be specific about who these people are, what they currently do, and why they'd switch to this solution.

3. **Vision & Purpose** (vision) — 80-150 words MINIMUM. The inspiring long-term vision: what the world looks like when this product succeeds at scale. The mission, the impact, and the "why" behind the idea. Make it compelling and forward-looking.

4. **Core Problem** (coreProblem) — 80-150 words MINIMUM. Describe the specific pain points in detail. Who suffers? How do they currently cope? What are the consequences of the problem going unsolved? Why existing solutions fall short.

5. **Brand & Identity** (brandIdentity) — Description: 60-120 words MINIMUM about the brand personality, mood, tone of voice, and visual style. Colors: provide 3-5 hex codes that form a cohesive palette with rationale. Fonts: suggest 2 font pairings (heading + body) that match the brand feel.

6. **Revenue Model** (revenueModel) — 80-150 words MINIMUM. Detail the monetization strategy: pricing tiers, what each tier includes, estimated price points, why this model fits the market, potential upsells, and how revenue scales with growth.

7. **Tech Stack** (techStack) — Tags: list 5-10 specific technologies. Notes: 80-150 words MINIMUM explaining architecture decisions, why each technology was chosen, how they work together, and any infrastructure considerations.

8. **Stage & Progress** (stageProgress) — Determine the current stage and provide detailed progress notes.

INTERVIEW RULES — READ VERY CAREFULLY:
- FIRST AND MOST IMPORTANT RULE: If the user's message is empty, gibberish, random characters, a single word, a period, or clearly NOT a real startup idea, DO NOT generate the board. Instead, respond with a "question" asking them to describe their actual idea. Say something friendly like "It looks like you haven't told me about your idea yet! What's the product or startup you're building? Even a rough sentence is great."
- ONLY ask CLARIFICATION questions about things the user ALREADY mentioned but that are UNCLEAR or AMBIGUOUS. For example, if the user says "an app for creators" you could ask what kind of creators or what the app helps them do — because the user mentioned it but it's vague.
- NEVER introduce new topics the user did not bring up. If the user did not mention target audience, revenue model, or tech stack, DO NOT ask about them. Use your own expert knowledge to fill those sections when completing.
- The ONE exception: you MAY ask about Brand & Identity (preferred vibe, colors, aesthetic) even if the user didn't mention it.
- Ask ONE question at a time. Maximum 5 questions total.
- If the user's pitch is clear and you understand what they're building, complete immediately — even after just one message. Do NOT ask questions for the sake of asking questions.
- If something in the user's description IS genuinely unclear or contradictory, ask about it. The goal is to understand their idea as THEY see it, not to interrogate them on every business aspect.
- If the user says "I'm not sure", "I don't know", "skip", or any uncertain response, accept it and move on or complete. Do NOT press on the same topic.
- If a user message says something like "Just fill it in", "You decide", or "Skip all questions", treat it as a request to complete immediately using your best judgment for all sections.
- Do NOT repeat what the user already told you.
- Be conversational and encouraging, like a real co-founder brainstorming together.
- Keep questions concise and specific — avoid multi-part questions.

RESPONSE FORMAT:
You MUST respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

When asking a clarification question:
{
  "type": "question",
  "message": "Your question here"
}

When you have enough information to fill the DNA board (or the user is unsure):
{
  "type": "complete",
  "message": "A brief, encouraging wrap-up message (1-2 sentences)",
  "sections": {
    "idea": "[400-600 words] A comprehensive narrative covering the full startup picture — concept, vision, audience, problem, solution, revenue, tech, and brand — in professional flowing prose.",
    "vision": "[80-150 words] The inspiring long-term vision, mission, and impact when this product succeeds at scale.",
    "coreProblem": "[80-150 words] The specific pain points, who suffers, current coping mechanisms, and why existing solutions fail.",
    "targetAudience": "[100-200 words] 2-3 specific user personas with demographics, behaviors, pain points, and motivations.",
    "revenueModel": "[80-150 words] Detailed monetization strategy with pricing tiers, price points, and how revenue scales.",
    "brandIdentity": {
      "description": "[60-120 words] Brand personality, mood, tone, and visual style description.",
      "colors": ["#hex1", "#hex2", "#hex3", "#hex4"],
      "fonts": ["HeadingFont", "BodyFont"]
    },
    "techStack": {
      "tags": ["Tech1", "Tech2", "Tech3", "Tech4", "Tech5", "...5-10 specific technologies"],
      "notes": "[80-150 words] Architecture decisions, technology rationale, and infrastructure considerations."
    },
    "progressStage": "idea",
    "progressNotes": "Current stage details and immediate next steps."
  },
  "suggestedName": "A short catchy name for the idea (only if user didn't provide one)"
}

CRITICAL: Every text section must meet its minimum word count. Do NOT write short generic sentences. Be specific, detailed, and tailored to this particular idea. For sections the user did NOT discuss (like target audience, tech stack, revenue model), use your expert startup knowledge to make excellent decisions — do NOT ask the user about them. The user is relying on you to produce high-quality, actionable content.`;

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...cleanMessages,
    ];

    console.log('Interview Chat — messages count:', cleanMessages.length);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: aiMessages,
      temperature: 0.5,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    });

    await trackApiUsage(userId, response, 'ideaInterview');

    const reply = response.choices[0].message.content;
    console.log('Interview AI response:', reply.substring(0, 200));

    // Check if the response was truncated
    const finishReason = response.choices[0].finish_reason;
    if (finishReason === 'length') {
      console.warn('Interview response truncated (finish_reason=length) — retrying with shorter prompt');
      // Truncated complete response — ask AI to just complete with the data it has
      try {
        const retryResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            ...aiMessages,
            { role: 'user', content: 'Please provide your complete response as valid JSON. Keep each text section to 80-120 words to fit within limits. Use \\n for newlines in strings.' },
          ],
          temperature: 0.3,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
        });
        await trackApiUsage(userId, retryResponse, 'ideaInterviewRetry');
        const retryReply = retryResponse.choices[0].message.content;
        const retryResult = JSON.parse(retryReply.trim());
        return res.json(retryResult);
      } catch (retryErr) {
        console.error('Truncation retry failed:', retryErr);
        return res.json({ type: 'question', message: "I have a great understanding of your idea! Type anything and I'll build your DNA board." });
      }
    }

    // Parse JSON — with json_object mode this should always succeed
    let result;
    try {
      result = JSON.parse(reply.trim());
    } catch (parseError) {
      console.error('Failed to parse interview response despite json_object mode:', parseError);
      // Fallback: strip code fences and retry parse
      let cleanReply = reply.trim();
      if (cleanReply.startsWith('```json')) cleanReply = cleanReply.slice(7);
      else if (cleanReply.startsWith('```')) cleanReply = cleanReply.slice(3);
      if (cleanReply.endsWith('```')) cleanReply = cleanReply.slice(0, -3);
      try {
        result = JSON.parse(cleanReply.trim());
      } catch (_) {
        // Truly unrecoverable — never dump raw JSON
        return res.json({ type: 'question', message: "I have a great understanding of your idea! Type anything and I'll build your DNA board." });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Interview chat error:', error);
    res.status(500).json({ error: 'Failed to process interview message' });
  }
};

module.exports = { syncIdeaWithAI, generateDnaSummary, interviewChat };
