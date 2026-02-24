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
2. Include ALL important details: the concept, the vision, the problem it solves, the target audience, the revenue model, technology, and current progress
3. Write in a clear, professional third-person style
4. Do NOT add information that is not in the provided sections — only summarize what is given
5. Make the summary flow naturally as one cohesive description, not a list of bullet points
6. Prioritize clarity — an AI reading this summary should fully understand what this idea is

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

module.exports = { syncIdeaWithAI, generateDnaSummary };
