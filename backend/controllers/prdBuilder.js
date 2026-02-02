const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const IdeaPitchResponseModel = require('../models/Idea-pitch-responses');
const ScoreboardResponseModel = require('../models/Scoreboard-responses');
const MarketResponseModel = require('../models/Market-responses');
const PrdPromptModel = require('../models/PrdPrompt');

// Rate limits (in milliseconds)
const PRD_COOLDOWN = 5 * 60 * 1000; // 5 minutes between PRD generations
const PROMPT_COOLDOWN = 60 * 1000; // 1 minute between prompt generations
const MAX_PRD_HISTORY = 3;
const MAX_PROMPT_HISTORY = 5;

// Get or create PRD/Prompt document for user+idea
async function getOrCreatePrdPromptDoc(userId, ideaId) {
  let doc = await PrdPromptModel.findOne({ userId, ideaId });
  if (!doc) {
    doc = await PrdPromptModel.create({ userId, ideaId, prds: [], prompts: [] });
  }
  return doc;
}

// Platform-specific prompt styles
const PLATFORM_STYLES = {
  lovable: {
    name: 'Lovable',
    description: 'Conversational, design-focused, describes desired UX outcomes',
    style: `Write prompts in a conversational, friendly tone. Focus on describing the desired user experience and visual design outcomes. 
Lovable works best with prompts that describe WHAT you want, not HOW to build it.
Start with the overall vision, then break down into features.
Emphasize design aesthetics, user flows, and the feeling you want users to have.
Use phrases like "I want...", "The user should be able to...", "It should feel like..."
Include specific details about colors, layouts, and interactions when relevant.`
  },
  replit: {
    name: 'Replit',
    description: 'Code-first, full-stack context, mentions Replit-specific features',
    style: `Write prompts optimized for Replit's AI agent. Be technical and specific.
Mention that you're building on Replit when relevant (for deployment, secrets, database).
Include full-stack context - frontend, backend, and database in one prompt.
Be explicit about file structure and naming conventions.
Mention using Replit's built-in features: Replit DB, Secrets, deployment.
Use clear, direct instructions. Replit works well with step-by-step technical requirements.
Specify the tech stack clearly at the start.`
  },
  cursor: {
    name: 'Cursor',
    description: 'Technical, file-path aware, incremental changes',
    style: `Write prompts optimized for Cursor IDE. Be highly technical and file-aware.
Cursor works best with specific, incremental changes rather than full rewrites.
Reference specific files and directories when possible.
Use technical terminology and be precise about implementations.
Break down tasks into smaller, focused changes.
Include context about existing code patterns to maintain consistency.
Mention specific functions, components, or modules to modify.
Use phrases like "In the file...", "Modify the function...", "Add to the existing..."
Cursor excels at understanding codebase context, so leverage that.`
  },
  bolt: {
    name: 'Bolt.new',
    description: 'Rapid prototyping, concise, quick iterations',
    style: `Write prompts for Bolt.new's rapid prototyping style. Keep prompts concise and focused.
Bolt excels at quick prototypes - focus on getting something working fast.
Be direct and specific about what you want built.
Don't over-engineer - Bolt is for MVPs and quick iterations.
Specify the core functionality first, polish later.
Use simple, clear language. Avoid overly complex requirements in a single prompt.
Good for: landing pages, simple apps, quick demos.
Structure: What it is → Core features → Basic styling.`
  },
  v0: {
    name: 'v0 by Vercel',
    description: 'UI/component focused, Tailwind-heavy, React components',
    style: `Write prompts optimized for v0 by Vercel. Focus on UI components and design.
v0 specializes in generating React components with Tailwind CSS.
Describe components visually - layout, spacing, colors, typography.
Reference shadcn/ui components when applicable (Button, Card, Dialog, etc.).
Be specific about responsive behavior and states (hover, active, disabled).
Describe the component hierarchy and composition.
Include specific Tailwind classes or describe the exact styling you want.
Good for: UI components, landing pages, dashboards, forms.
Focus on one component or section at a time for best results.`
  },
  windsurf: {
    name: 'Windsurf',
    description: 'Structured, agentic, step-by-step workflows',
    style: `Write prompts for Windsurf's agentic coding style. Be structured and methodical.
Windsurf works well with clear, organized prompts that follow a logical flow.
Break down the project into phases or steps.
Be explicit about dependencies between different parts.
Include context about the overall architecture and how pieces fit together.
Use numbered lists or clear sections for different features.
Windsurf can handle complex, multi-file changes - leverage that capability.
Include acceptance criteria or success conditions when possible.
Structure: Overview → Architecture → Features (prioritized) → Technical details.`
  }
};

// Prompt types
const PROMPT_TYPES = {
  initial: {
    name: 'Initial Setup',
    description: 'Gets the project scaffolded with base structure'
  },
  frontend: {
    name: 'Frontend',
    description: 'UI/UX implementation details'
  },
  backend: {
    name: 'Backend',
    description: 'API, database, authentication'
  },
  features: {
    name: 'Feature-by-Feature',
    description: 'Broken down into individual features'
  },
  fullstack: {
    name: 'Full Stack',
    description: 'Complete app in one comprehensive prompt'
  }
};

// Generate PRD
const generatePRD = async (req, res) => {
  const userId = req.user.userId;
  const { ideaId } = req.body;

  try {
    // Get or create the PRD/Prompt document
    const prdDoc = await getOrCreatePrdPromptDoc(userId, ideaId);

    // Check rate limit (server-side, not bypassable)
    if (prdDoc.lastPrdGeneratedAt) {
      const timeSinceLastPrd = Date.now() - new Date(prdDoc.lastPrdGeneratedAt).getTime();
      if (timeSinceLastPrd < PRD_COOLDOWN) {
        const remainingTime = Math.ceil((PRD_COOLDOWN - timeSinceLastPrd) / 1000);
        return res.status(429).json({ 
          error: `Please wait ${remainingTime} seconds before generating another PRD.`,
          remainingSeconds: remainingTime
        });
      }
    }

    // Fetch user's idea data (Idea model uses _id, other models use ideaId field)
    const ideaData = await IdeaPitchResponseModel.findOne({ _id: ideaId, userId });
    const scoreboardData = await ScoreboardResponseModel.findOne({ ideaId, userId });
    const marketData = await MarketResponseModel.findOne({ ideaId, userId });

    if (!ideaData) {
      return res.status(404).json({ error: 'Idea not found. Please create an idea first.' });
    }

    const ideaContent = ideaData.idea || '';
    const scoreboardContent = scoreboardData?.scoreboardResponse || '';
    const marketContent = marketData?.marketResponse || '';

    const systemPrompt = `You are an expert product manager and technical writer. Generate a comprehensive, professional Product Requirements Document (PRD) based on the startup idea provided.

The PRD should be detailed, actionable, and ready for a development team to use. Format it in clean Markdown.

Include these sections:
1. **Executive Summary** - Brief overview of the product
2. **Problem Statement** - The problem being solved
3. **Proposed Solution** - How the product solves it
4. **Target Users** - User personas with demographics and pain points
5. **Core Features** - Detailed feature list with user stories (As a [user], I want [feature], so that [benefit])
6. **User Flows** - Key user journeys through the app
7. **Technical Requirements** - Tech stack recommendations, integrations, infrastructure
8. **Data Models** - Key entities and their relationships
9. **API Endpoints** - Main API routes needed
10. **Success Metrics** - KPIs to measure success
11. **MVP Scope** - What's included in v1 vs future versions
12. **Timeline Estimate** - Rough development phases
13. **Risks & Assumptions** - Potential challenges
14. **Open Questions** - Items needing clarification

Be specific, practical, and thorough. This should be a document that developers can actually build from.`;

    const userPrompt = `Generate a comprehensive PRD for this startup idea:

**Idea:**
${ideaContent}

${scoreboardContent ? `**Scoreboard Analysis:**
${scoreboardContent}` : ''}

${marketContent ? `**Market Research:**
${marketContent}` : ''}

Please create a detailed, professional PRD that a development team could use to build this product.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    await trackApiUsage(userId, response, 'prd-generator');

    const prd = response.choices[0].message.content;

    // Save to database with history management
    const newPrd = {
      content: prd,
      ideaName: ideaData.ideaName || 'Unnamed Idea',
      createdAt: new Date()
    };

    // Add new PRD to the beginning of the array
    prdDoc.prds.unshift(newPrd);
    
    // Keep only the most recent MAX_PRD_HISTORY PRDs
    if (prdDoc.prds.length > MAX_PRD_HISTORY) {
      prdDoc.prds = prdDoc.prds.slice(0, MAX_PRD_HISTORY);
    }

    // Update last generated timestamp
    prdDoc.lastPrdGeneratedAt = new Date();
    await prdDoc.save();
    
    console.log('📝 PRD saved - userId:', userId, 'ideaId:', ideaId, 'total PRDs:', prdDoc.prds.length);

    res.json({ 
      success: true, 
      prd,
      ideaName: ideaData.ideaName || 'Your Idea',
      history: prdDoc.prds
    });

  } catch (err) {
    console.error('PRD Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate PRD. Please try again.' });
  }
};

// Generate AI Coding Prompt
const generatePrompt = async (req, res) => {
  const userId = req.user.userId;
  const { ideaId, platform, promptType, techStack, styling, database } = req.body;

  try {
    // Validate platform
    if (!PLATFORM_STYLES[platform]) {
      return res.status(400).json({ error: 'Invalid platform selected.' });
    }

    // Get or create the PRD/Prompt document
    const prdDoc = await getOrCreatePrdPromptDoc(userId, ideaId);

    // Check rate limit (server-side, not bypassable)
    if (prdDoc.lastPromptGeneratedAt) {
      const timeSinceLastPrompt = Date.now() - new Date(prdDoc.lastPromptGeneratedAt).getTime();
      if (timeSinceLastPrompt < PROMPT_COOLDOWN) {
        const remainingTime = Math.ceil((PROMPT_COOLDOWN - timeSinceLastPrompt) / 1000);
        return res.status(429).json({ 
          error: `Please wait ${remainingTime} seconds before generating another prompt.`,
          remainingSeconds: remainingTime
        });
      }
    }

    // Fetch user's idea data (Idea model uses _id, other models use ideaId field)
    const ideaData = await IdeaPitchResponseModel.findOne({ _id: ideaId, userId });
    const scoreboardData = await ScoreboardResponseModel.findOne({ ideaId, userId });

    if (!ideaData) {
      return res.status(404).json({ error: 'Idea not found. Please create an idea first.' });
    }

    const ideaContent = ideaData.idea || '';
    const platformStyle = PLATFORM_STYLES[platform];
    const promptTypeInfo = PROMPT_TYPES[promptType] || PROMPT_TYPES.fullstack;

    const systemPrompt = `You are an expert at writing prompts for AI coding assistants. Your task is to generate the perfect prompt for ${platformStyle.name} to build a startup app.

**Platform-Specific Guidelines for ${platformStyle.name}:**
${platformStyle.style}

**Prompt Type:** ${promptTypeInfo.name} - ${promptTypeInfo.description}

**User's Tech Preferences:**
- Tech Stack: ${techStack || 'Best suited for the project'}
- Styling: ${styling || 'Modern, clean design'}
- Database: ${database || 'Best suited for the project'}

Generate a prompt that:
1. Is perfectly tailored for ${platformStyle.name}'s AI
2. Includes all necessary context for the AI to build the app
3. Is clear, specific, and actionable
4. Follows the platform's best practices
5. Results in a working, production-quality app

Output ONLY the prompt text that the user should paste into ${platformStyle.name}. Do not include any meta-commentary or explanations - just the actual prompt.`;

    const userPrompt = `Generate a ${promptTypeInfo.name.toLowerCase()} prompt for ${platformStyle.name} to build this app:

**App Idea:**
${ideaContent}

${scoreboardData?.scoreboardResponse ? `**Key Insights from Analysis:**
${scoreboardData.scoreboardResponse}` : ''}

Create the perfect prompt for ${platformStyle.name} that will result in a high-quality, working application.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    await trackApiUsage(userId, response, 'prompt-generator');

    const generatedPrompt = response.choices[0].message.content;

    // Save to database with history management
    const newPrompt = {
      content: generatedPrompt,
      platform: platformStyle.name,
      promptType: promptTypeInfo.name,
      createdAt: new Date()
    };

    // Add new prompt to the beginning of the array
    prdDoc.prompts.unshift(newPrompt);
    
    // Keep only the most recent MAX_PROMPT_HISTORY prompts
    if (prdDoc.prompts.length > MAX_PROMPT_HISTORY) {
      prdDoc.prompts = prdDoc.prompts.slice(0, MAX_PROMPT_HISTORY);
    }

    // Update last generated timestamp
    prdDoc.lastPromptGeneratedAt = new Date();
    await prdDoc.save();
    
    console.log('🤖 Prompt saved - userId:', userId, 'ideaId:', ideaId, 'total prompts:', prdDoc.prompts.length);

    res.json({ 
      success: true, 
      prompt: generatedPrompt,
      platform: platformStyle.name,
      promptType: promptTypeInfo.name,
      history: prdDoc.prompts
    });

  } catch (err) {
    console.error('Prompt Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate prompt. Please try again.' });
  }
};

// Get available platforms
const getPlatforms = async (req, res) => {
  const platforms = Object.entries(PLATFORM_STYLES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description
  }));

  const promptTypes = Object.entries(PROMPT_TYPES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description
  }));

  res.json({ platforms, promptTypes });
};

// Get saved PRDs and prompts for an idea
const getHistory = async (req, res) => {
  const userId = req.user.userId;
  const { ideaId } = req.params;

  console.log('📜 getHistory called - userId:', userId, 'ideaId:', ideaId);

  try {
    const doc = await PrdPromptModel.findOne({ userId, ideaId });
    
    console.log('📜 Found document:', doc ? `${doc.prds?.length || 0} PRDs, ${doc.prompts?.length || 0} prompts` : 'null');
    
    res.json({
      success: true,
      prds: doc?.prds || [],
      prompts: doc?.prompts || [],
      lastPrdGeneratedAt: doc?.lastPrdGeneratedAt || null,
      lastPromptGeneratedAt: doc?.lastPromptGeneratedAt || null,
      prdCooldown: PRD_COOLDOWN,
      promptCooldown: PROMPT_COOLDOWN
    });
  } catch (err) {
    console.error('Get History Error:', err);
    res.status(500).json({ error: 'Failed to load history.' });
  }
};

module.exports = {
  generatePRD,
  generatePrompt,
  getPlatforms,
  getHistory
};
