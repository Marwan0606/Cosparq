const BrainstormSession = require('../models/BrainstormSession');
const OpenAI = require('openai');
const { trackApiUsage } = require('../services/apiUsageTracker');
const { sanitizeString, maxLength, ensureString, sanitizeObject } = require('../middleware/sanitize');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate AI suggestions based on context
const generateSuggestions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { context, existingIdeas, userPreferences, projectName, projectDescription, focusCategory } = req.body;
    
    // Sanitize AI prompt inputs with length limits
    const safeProjectName = sanitizeString(maxLength(ensureString(projectName), 200));
    const safeProjectDescription = sanitizeString(maxLength(ensureString(projectDescription), 2000));
    const safeFocusCategory = sanitizeString(maxLength(ensureString(focusCategory), 100));
    const safeContext = sanitizeString(maxLength(ensureString(context), 2000));
    
    // Build the prompt - now focused on features for the user's app
    let prompt = `You are a creative product feature brainstorming assistant. Your job is to suggest innovative features that could be added to a user's app or product.`;
    
    // Add project context if available
    if (safeProjectName && safeProjectName !== 'Your App' && safeProjectName !== 'No project selected') {
      prompt += `\n\nThe user is building an app called "${safeProjectName}".`;
      if (safeProjectDescription) {
        prompt += ` Here's what the app does: ${safeProjectDescription.substring(0, 500)}`;
      }
    }
    
    // FOCUS MODE: If user is focused on a specific category, tailor suggestions
    if (safeFocusCategory) {
      prompt += `\n\n**IMPORTANT: The user is in FOCUS MODE for the "${safeFocusCategory}" category.** Generate ideas that specifically fit within this category theme. All suggestions must be directly related to "${safeFocusCategory}".`;
    }
    
    if (userPreferences && userPreferences.acceptedTopics && userPreferences.acceptedTopics.length > 0) {
      prompt += `\n\nThe user has shown interest in these types of features: ${userPreferences.acceptedTopics.slice(-5).join(', ')}. Suggest similar or complementary features.`;
    }
    
    if (existingIdeas && existingIdeas.length > 0) {
      prompt += `\n\nThe user has already brainstormed these features in this category: ${existingIdeas.join('; ')}. Generate NEW and DIFFERENT feature ideas that complement these but don't repeat them.`;
    }
    
    if (safeContext && safeContext.trim()) {
      prompt += `\n\nThe user is currently thinking about: "${safeContext}". Generate feature ideas related to this${safeFocusCategory ? ` within the "${safeFocusCategory}" category` : ''}.`;
    }
    
    prompt += `\n\nGenerate exactly 5 unique, specific feature suggestions${safeFocusCategory ? ` for the "${safeFocusCategory}" category` : ' for their app'}. Each should be a concise feature description (max 12 words) that would add value to the product. Focus on practical, implementable features.

Examples of good feature suggestions:
- "Real-time collaboration with team members"
- "AI-powered recommendations based on user behavior"
- "Dark mode with customizable color themes"
- "Push notifications for important updates"
- "Integration with Google Calendar"

Return ONLY a JSON array of 5 strings, no explanation:
["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: `You are a product feature brainstorming assistant.${safeFocusCategory ? ` Focus exclusively on "${safeFocusCategory}" category features.` : ''} Return only valid JSON arrays of feature suggestions.` },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 300
    });

    // Track API usage
    console.log('🔍 Brainstorm Suggestions - userId:', userId);
    console.log('🔍 Brainstorm Suggestions - completion.usage:', completion.usage);
    if (userId) {
      const trackResult = await trackApiUsage(userId, completion, 'brainstorm-suggestions');
      console.log('🔍 Track result:', trackResult);
    } else {
      console.log('⚠️ No userId found for tracking');
    }

    let suggestions;
    try {
      const responseText = completion.choices[0].message.content.trim();
      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found');
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback suggestions - now feature-focused
      suggestions = [
        'User authentication with social login',
        'Real-time notifications and alerts',
        'Dashboard with analytics overview',
        'Export data to PDF or CSV',
        'Dark mode and theme customization'
      ];
    }

    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating suggestions',
      suggestions: [
        'User authentication with social login',
        'Real-time notifications and alerts',
        'Dashboard with analytics overview',
        'Export data to PDF or CSV',
        'Dark mode and theme customization'
      ]
    });
  }
};

// Organize ideas into branches using AI
const organizeIdeas = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { ideas, existingBranches } = req.body;
    
    if (!ideas || ideas.length < 2) {
      return res.status(400).json({ success: false, message: 'Need at least 2 ideas to organize' });
    }

    const ideasText = ideas.map((idea, i) => `${i + 1}. [ID: ${idea.id}] ${idea.text}`).join('\n');
    
    const prompt = `You are organizing brainstormed ideas into logical categories.

Ideas to organize:
${ideasText}

Create 2-4 meaningful category branches based on the themes in these ideas. Each branch should have:
- A short, descriptive name (2-4 words)
- A position: one of "top-left", "top-right", "bottom-left", "bottom-right"
- Assigned idea IDs that fit that category

Rules:
- Every idea must be assigned to exactly one branch
- Branch names should capture the essence of the grouped ideas
- Use all 4 positions if you have 4 or more ideas
- Be creative with category names (e.g., "User Experience", "AI Magic", "Growth Engine", "Core Features")

Return ONLY valid JSON in this exact format:
{
  "branches": [
    { "id": "branch-1", "name": "Category Name", "position": "top-left", "color": "#ec4899" },
    { "id": "branch-2", "name": "Category Name", "position": "top-right", "color": "#f97316" }
  ],
  "ideaAssignments": [
    { "ideaId": "idea_xxx", "branchId": "branch-1" }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: 'You are a categorization expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 600
    });

    // Track API usage
    console.log('🔍 Brainstorm Organize - userId:', userId);
    if (userId) {
      const trackResult = await trackApiUsage(userId, completion, 'brainstorm-organize');
      console.log('🔍 Track result:', trackResult);
    } else {
      console.log('⚠️ No userId found for tracking');
    }

    let result;
    try {
      const responseText = completion.choices[0].message.content.trim();
      // Extract JSON object from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON object found');
      }
    } catch (parseError) {
      console.error('Error parsing AI organization response:', parseError);
      // Fallback: create simple organization
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
      const colors = ['#ec4899', '#f97316', '#ec4899', '#f97316'];
      
      result = {
        branches: [
          { id: 'branch-1', name: 'Core Ideas', position: 'top-left', color: '#ec4899' },
          { id: 'branch-2', name: 'Features', position: 'top-right', color: '#f97316' }
        ],
        ideaAssignments: ideas.map((idea, i) => ({
          ideaId: idea.id,
          branchId: i % 2 === 0 ? 'branch-1' : 'branch-2'
        }))
      };
    }

    res.json({ 
      success: true, 
      branches: result.branches,
      ideaAssignments: result.ideaAssignments
    });
  } catch (error) {
    console.error('Error organizing ideas:', error);
    res.status(500).json({ success: false, message: 'Error organizing ideas' });
  }
};

// Save or update a session
const saveSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = ensureString(req.body.sessionId);
    const projectId = ensureString(req.body.projectId);
    
    // Sanitize all text inputs
    const ideas = Array.isArray(req.body.ideas) ? req.body.ideas.map(idea => ({
      ...idea,
      text: typeof idea.text === 'string' ? sanitizeString(maxLength(idea.text, 500)) : idea.text
    })) : [];
    const branches = Array.isArray(req.body.branches) ? req.body.branches.map(b => ({
      ...b,
      name: typeof b.name === 'string' ? sanitizeString(maxLength(b.name, 100)) : b.name
    })) : [];
    const userContext = sanitizeString(maxLength(ensureString(req.body.userContext), 2000));
    const name = sanitizeString(maxLength(ensureString(req.body.name), 200));
    const { suggestions, focusSuggestions } = req.body;
    
    console.log('Saving session - branches:', JSON.stringify(branches?.slice(0, 2), null, 2));
    
    let session;
    
    if (sessionId) {
      // Update existing session
      session = await BrainstormSession.findOne({ _id: sessionId, userId });
      
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }
      
      session.ideas = ideas || [];
      session.branches = branches || [];
      session.userContext = userContext || session.userContext;
      if (suggestions !== undefined) session.suggestions = suggestions;
      if (focusSuggestions !== undefined) session.focusSuggestions = focusSuggestions;
      if (name) session.name = name;
      if (projectId) session.projectId = projectId;
      
      await session.save();
    } else if (projectId) {
      // Try to find existing session for this project
      session = await BrainstormSession.findOne({ userId, projectId, isActive: true });
      
      if (session) {
        // Update existing project session
        session.ideas = ideas || [];
        session.branches = branches || [];
        session.userContext = userContext || session.userContext;
        if (suggestions !== undefined) session.suggestions = suggestions;
        if (focusSuggestions !== undefined) session.focusSuggestions = focusSuggestions;
        if (name) session.name = name;
        await session.save();
      } else {
        // Create new session for this project
        session = new BrainstormSession({
          userId,
          projectId,
          ideas: ideas || [],
          branches: branches || [],
          userContext: userContext || {},
          suggestions: suggestions || [],
          focusSuggestions: focusSuggestions || {},
          name: name || 'Untitled Session'
        });
        await session.save();
      }
    } else {
      // Create new session without project
      session = new BrainstormSession({
        userId,
        ideas: ideas || [],
        branches: branches || [],
        userContext: userContext || {},
        suggestions: suggestions || [],
        focusSuggestions: focusSuggestions || {},
        name: name || 'Untitled Session'
      });
      
      await session.save();
    }
    
    res.json({ 
      success: true, 
      sessionId: session._id,
      message: 'Session saved'
    });
  } catch (error) {
    console.error('Error saving session:', error.message);
    console.error('Error details:', error);
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({ success: false, message: 'Error saving session', error: error.message });
  }
};

// Get session by project ID
const getSessionByProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { projectId } = req.params;
    
    const session = await BrainstormSession.findOne({ userId, projectId, isActive: true });
    
    if (!session) {
      return res.json({ success: true, session: null, message: 'No session found for this project' });
    }
    
    res.json({ success: true, session });
  } catch (error) {
    console.error('Error getting session by project:', error);
    res.status(500).json({ success: false, message: 'Error getting session' });
  }
};

// Get a session by ID
const getSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    const session = await BrainstormSession.findOne({ _id: id, userId });
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    res.json({ success: true, session });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ success: false, message: 'Error getting session' });
  }
};

// Get all sessions for a user
const getUserSessions = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const sessions = await BrainstormSession.find({ userId, isActive: true })
      .select('_id name createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20);
    
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({ success: false, message: 'Error getting sessions' });
  }
};

// Delete a session
const deleteSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    const result = await BrainstormSession.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, message: 'Error deleting session' });
  }
};

// Categorize a single idea - determines which branch it belongs to or creates a new one
const categorizeIdea = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const ideaText = sanitizeString(maxLength(ensureString(req.body.ideaText), 500));
    const existingBranches = req.body.existingBranches;
    const projectName = sanitizeString(maxLength(ensureString(req.body.projectName), 200));
    const projectDescription = sanitizeString(maxLength(ensureString(req.body.projectDescription), 2000));
    
    if (!ideaText) {
      return res.status(400).json({ success: false, message: 'Idea text is required' });
    }

    // Build context about existing branches
    let branchContext = '';
    if (existingBranches && existingBranches.length > 0) {
      branchContext = existingBranches.map(b => `- "${b.name}" (ID: ${b.id}): ${b.ideas ? b.ideas.length : 0} ideas`).join('\n');
    }

    const prompt = `You are categorizing a feature idea for an app${projectName ? ` called "${projectName}"` : ''}.

New idea to categorize: "${ideaText}"

${branchContext ? `Existing categories:\n${branchContext}\n` : 'No existing categories yet.'}

Your task:
1. If the idea fits well into an existing category, assign it there
2. If no existing category fits well, create a NEW category with a broad, descriptive name (2-3 words)

Category naming guidelines:
- Use broad categories like: "User Features", "AI Integration", "App Pages", "Innovative Features", "Core Functionality", "Social Features", "Data & Analytics", "Settings & Config", "Monetization", "Security", "Performance"
- Categories should be able to hold 3-5+ related ideas
- Don't create overly specific categories

Return ONLY valid JSON:
{
  "action": "existing" or "new",
  "branchId": "branch-id-here" (if existing) or null (if new),
  "newBranch": { "name": "Category Name", "position": "top-left|top-right|bottom-left|bottom-right" } (if new) or null (if existing)
}

Positions to use for new branches (in order): top-left, top-right, bottom-left, bottom-right`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: 'You are a categorization expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 200
    });

    // Track API usage
    console.log('🔍 Brainstorm Categorize - userId:', userId);
    if (userId) {
      const trackResult = await trackApiUsage(userId, completion, 'brainstorm-categorize');
      console.log('🔍 Track result:', trackResult);
    } else {
      console.log('⚠️ No userId found for tracking');
    }

    let result;
    try {
      const responseText = completion.choices[0].message.content.trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON object found');
      }
    } catch (parseError) {
      console.error('Error parsing categorization response:', parseError);
      // Fallback: create a new "Features" branch or use first existing
      if (existingBranches && existingBranches.length > 0) {
        result = { action: 'existing', branchId: existingBranches[0].id, newBranch: null };
      } else {
        result = { action: 'new', branchId: null, newBranch: { name: 'Features', position: 'top-left' } };
      }
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error categorizing idea:', error);
    res.status(500).json({ success: false, message: 'Error categorizing idea' });
  }
};

module.exports = {
  generateSuggestions,
  organizeIdeas,
  categorizeIdea,
  saveSession,
  getSession,
  getSessionByProject,
  getUserSessions,
  deleteSession
};
