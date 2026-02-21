/**
 * AI Co-Founder Controller
 * 
 * Handles:
 * - Starting meetings with context aggregation
 * - Processing voice messages
 * - Generating AI responses
 * - Creating meeting summaries
 * - Sending summary emails
 */

const { google } = require('googleapis');
const CofounderSession = require('../models/CofounderSession');
const Idea = require('../models/Idea-pitch-responses');
const ScoreboardResponse = require('../models/Scoreboard-responses');
const Task = require('../models/Task');
const User = require('../models/Users');
const OpenAI = require('openai');
const { trackApiUsage, trackAudioUsage } = require('../services/apiUsageTracker');
const { sendMeetingSummaryEmail } = require('../services/emailService');
const { getAuthenticatedClient } = require('./google');
const ActionLog = require('../models/ActionLog');
const { sanitizeString, maxLength, ensureString, ensureBoolean, isValidEmail, stripNewlines, isOneOf } = require('../middleware/sanitize');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Action tools for voice chat (same as chat)
const ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email via Gmail. Use when the user asks to send, draft, or compose an email to someone.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "The recipient's email address" },
          subject: { type: "string", description: "The email subject line" },
          body: { type: "string", description: "The email body content" }
        },
        required: ["to", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a Google Calendar event. Use when the user wants to schedule a meeting, reminder, or event.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The event title" },
          description: { type: "string", description: "The event description" },
          date: { type: "string", description: "The event date in YYYY-MM-DD format" },
          startTime: { type: "string", description: "Start time in HH:MM format (24-hour)" },
          endTime: { type: "string", description: "End time in HH:MM format (24-hour)" },
          attendees: { type: "array", items: { type: "string" }, description: "List of attendee email addresses (optional)" }
        },
        required: ["title", "date", "startTime", "endTime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_slides",
      description: "Create a Google Slides presentation for planning. Use when user wants to create a pitch deck or presentation outline.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The presentation title" },
          purpose: { type: "string", description: "The purpose of the presentation" },
          keyPoints: { type: "array", items: { type: "string" }, description: "Key points to cover" }
        },
        required: ["title", "purpose"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_form",
      description: "Create a Google Form for surveys or feedback. Use when user wants to create a form or questionnaire.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The form title" },
          purpose: { type: "string", description: "The purpose of the form" },
          targetAudience: { type: "string", description: "Who the form is for" }
        },
        required: ["title", "purpose"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_spreadsheet",
      description: "Create a Google Sheets spreadsheet. Use when user wants to create a tracker, budget, or data table.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The spreadsheet title" },
          purpose: { type: "string", description: "The purpose of the spreadsheet" },
          columns: { type: "array", items: { type: "string" }, description: "Suggested column headers" }
        },
        required: ["title", "purpose"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a single task on the user's task board. Use when the user asks to add, create, or note down a task, to-do, or action item.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The task title" },
          description: { type: "string", description: "Detailed description of what to do" },
          assignedToName: { type: "string", description: "A short label for this task group (1-4 words)" },
          urgency: { type: "string", enum: ["low", "medium", "high"], description: "The urgency level" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_multiple_tasks",
      description: "Create MULTIPLE tasks on the user's task board at once. Use when the user asks to add several tasks, break something into steps, or create a list of to-dos.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            description: "Array of tasks to create",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "The task title" },
                description: { type: "string", description: "Detailed description of what to do" },
                assignedToName: { type: "string", description: "A short label for this task group (1-4 words)" },
                urgency: { type: "string", enum: ["low", "medium", "high"], description: "The urgency level" }
              },
              required: ["title"]
            }
          }
        },
        required: ["tasks"]
      }
    }
  }
];

/**
 * System prompt for the AI Co-Founder
 */
const COFOUNDER_SYSTEM_PROMPT = `You are an AI Co-Founder - a straight-talking startup partner who's been through the trenches. You're in a voice conversation with a founder about their startup.

Your style:
- Direct and honest. If something's a bad idea, say it clearly: "I don't think that's going to work because..."
- If something's good, be genuine: "That's actually solid because..."
- No sugarcoating. No corporate fluff. No empty encouragement.
- Talk like a real co-founder would - casual, to the point, occasionally blunt.
- Short responses are fine. Don't pad answers. If "Yes, do it" is the right answer, just say that.

Your job:
- Help them build something that actually works
- Call out weak spots before the market does
- Push back on bad assumptions - founders need someone who'll say no
- Suggest concrete next steps, not vague advice
- If you see a real problem, name it directly

Response length:
- Match the energy. Quick question? Quick answer.
- Only go longer when you're explaining something complex or important.
- 1-3 sentences is usually enough for voice.

You're not here to make them feel good. You're here to help them succeed.`;

/**
 * Aggregate context for a user's idea
 * Pulls together idea description, scoreboard results, and pending tasks
 */
const aggregateContext = async (userId, ideaId) => {
  const context = {
    idea: { name: '', description: '' },
    scoreboard: { score: null, highlights: [] },
    pendingTasks: 0,
    recentTasks: []
  };

  try {
    // Get the idea
    const idea = await Idea.findOne({ _id: ideaId, userId });
    if (idea) {
      context.idea.name = idea.ideaName || '';
      context.idea.description = idea.idea || '';
    }

    // Get scoreboard response
    const scoreboard = await ScoreboardResponse.findOne({ ideaId, userId });
    if (scoreboard && scoreboard.scoreboardResponse) {
      try {
        // Try to parse scoreboard data for key metrics
        const scoreData = JSON.parse(scoreboard.scoreboardResponse);
        if (scoreData.overallScore) {
          context.scoreboard.score = scoreData.overallScore;
        }
        // Extract highlights from scoreboard categories
        if (scoreData.categories) {
          context.scoreboard.highlights = Object.entries(scoreData.categories)
            .filter(([_, data]) => data.score >= 7)
            .map(([category, data]) => `${category}: ${data.score}/10`)
            .slice(0, 3);
        }
      } catch (e) {
        // If not JSON, just note that scoreboard exists
        context.scoreboard.highlights = ['Scoreboard analysis available'];
      }
    }

    // Get tasks
    const tasks = await Task.find({ ideaId, userId }).sort({ createdAt: -1 }).limit(10);
    context.pendingTasks = tasks.filter(t => !t.completed).length;
    context.recentTasks = tasks
      .filter(t => !t.completed)
      .slice(0, 5)
      .map(t => t.title);

  } catch (error) {
    console.error('Error aggregating context:', error);
  }

  return context;
};

/**
 * Build context prompt for AI
 */
const buildContextPrompt = (contextSnapshot) => {
  let prompt = '';

  if (contextSnapshot.idea?.name) {
    prompt += `\n\nCURRENT IDEA: "${contextSnapshot.idea.name}"`;
    if (contextSnapshot.idea.description) {
      prompt += `\nDescription: ${contextSnapshot.idea.description.substring(0, 500)}`;
    }
  }

  if (contextSnapshot.scoreboard?.score) {
    prompt += `\n\nSCOREBOARD: Overall score ${contextSnapshot.scoreboard.score}/10`;
    if (contextSnapshot.scoreboard.highlights?.length > 0) {
      prompt += `\nStrong areas: ${contextSnapshot.scoreboard.highlights.join(', ')}`;
    }
  }

  if (contextSnapshot.pendingTasks > 0) {
    prompt += `\n\nPENDING TASKS: ${contextSnapshot.pendingTasks} tasks`;
    if (contextSnapshot.recentTasks?.length > 0) {
      prompt += `\nRecent: ${contextSnapshot.recentTasks.slice(0, 3).join('; ')}`;
    }
  }

  return prompt;
};

/**
 * Start a new meeting session
 * POST /api/cofounder/start
 */
const startSession = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { ideaId } = req.body;

    // ideaId is optional - can have general conversations without an idea
    
    // Check for any active sessions and mark them as abandoned
    await CofounderSession.updateMany(
      { userId, status: 'active' },
      { status: 'abandoned', endedAt: new Date() }
    );

    // Aggregate context (works with or without ideaId)
    const contextSnapshot = ideaId 
      ? await aggregateContext(userId, ideaId)
      : { idea: { name: '', description: '' }, scoreboard: {}, pendingTasks: 0, recentTasks: [] };

    // Create new session
    const session = new CofounderSession({
      userId,
      ideaId: ideaId || null,
      contextSnapshot,
      status: 'active',
      startedAt: new Date()
    });

    await session.save();

    // Generate initial greeting based on context
    const contextPrompt = buildContextPrompt(contextSnapshot);
    const greeting = await generateGreeting(contextSnapshot);

    res.json({
      success: true,
      sessionId: session._id,
      greeting,
      context: {
        ideaName: contextSnapshot.idea?.name || 'Your idea',
        hasScoreboard: !!contextSnapshot.scoreboard?.score,
        pendingTasks: contextSnapshot.pendingTasks
      }
    });

  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
};

/**
 * Generate personalized greeting based on context
 */
const generateGreeting = async (contextSnapshot) => {
  let greeting = "Hey! ";

  if (contextSnapshot.idea?.name) {
    greeting += `So you're working on ${contextSnapshot.idea.name}. `;
    
    if (contextSnapshot.pendingTasks > 0) {
      greeting += `Looks like you've got ${contextSnapshot.pendingTasks} tasks lined up. `;
    }
    
    greeting += "What do you want to dig into today?";
  } else {
    greeting += "What's on your mind? We can brainstorm ideas, work through challenges, or plan your next moves.";
  }

  return greeting;
};

/**
 * Send a message in the conversation
 * POST /api/cofounder/message
 */
const sendMessage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const sessionId = ensureString(req.body.sessionId);
    const message = sanitizeString(maxLength(ensureString(req.body.message), 5000));
    const { pendingAction, actionApproved } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    // Fetch user's name for personalized responses (emails, etc.)
    const userDoc = await User.findById(userId).select('name displayName').lean();
    const userName = userDoc?.displayName || userDoc?.name || '';

    // Find the active session
    const session = await CofounderSession.findOne({
      _id: sessionId,
      userId,
      status: 'active'
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or not active' });
    }

    // Handle action approval flow
    if (pendingAction && actionApproved !== undefined) {
      // Server-side validation of action data
      const validActionTypes = ['send_email', 'create_calendar_event', 'create_slides', 'create_form', 'create_spreadsheet', 'create_task', 'create_multiple_tasks'];
      if (!pendingAction.actionType || !validActionTypes.includes(pendingAction.actionType)) {
        return res.status(400).json({ error: 'Invalid action type' });
      }
      if (pendingAction.actionType === 'send_email' && pendingAction.actionData) {
        if (!isValidEmail(ensureString(pendingAction.actionData.to))) {
          return res.status(400).json({ error: 'Invalid recipient email address' });
        }
        pendingAction.actionData.subject = stripNewlines(sanitizeString(maxLength(ensureString(pendingAction.actionData.subject), 500)));
        pendingAction.actionData.body = sanitizeString(maxLength(ensureString(pendingAction.actionData.body), 10000));
      }
      return handleVoiceActionApproval(req, res, userId, session, pendingAction, actionApproved, message);
    }

    // Add user message to transcript
    session.transcript.push({
      speaker: 'user',
      text: message,
      timestamp: new Date()
    });

    // Build conversation history for AI
    const messages = [
      { role: 'system', content: COFOUNDER_SYSTEM_PROMPT + buildContextPrompt(session.contextSnapshot) + `
${userName ? `
The user's name is ${userName}. When composing any emails or written communications, sign off using their name.` : ''}
You can also help the user take actions like sending emails, scheduling calendar events, creating presentations, forms, or spreadsheets. When they ask for these, use the appropriate tool.` }
    ];

    // Add transcript to messages (last 10 exchanges)
    const recentTranscript = session.transcript.slice(-20);
    for (const msg of recentTranscript) {
      messages.push({
        role: msg.speaker === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    }

    // Generate AI response with tool support
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: ACTION_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 200
    });

    const responseMessage = completion.choices[0].message;

    // Check if AI wants to call a tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      // Generate voice-friendly action preview
      const preview = generateVoiceActionPreview(functionName, args);

      // Store pending action in transcript as a special message
      session.transcript.push({
        speaker: 'ai',
        text: preview.voiceResponse,
        timestamp: new Date(),
        isPendingAction: true,
        actionType: functionName,
        actionData: args
      });

      await session.save();

      // Track API usage
      if (userId) {
        await trackApiUsage(userId, completion, 'cofounder-chat');
      }

      return res.json({
        success: true,
        response: preview.voiceResponse,
        actionPending: true,
        actionType: functionName,
        actionData: args,
        actionPreview: preview
      });
    }

    const aiResponse = responseMessage.content;

    // Add AI response to transcript
    session.transcript.push({
      speaker: 'ai',
      text: aiResponse,
      timestamp: new Date()
    });

    await session.save();

    // Track API usage
    if (userId) {
      await trackApiUsage(userId, completion, 'cofounder-chat');
    }

    res.json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

/**
 * Generate voice-friendly action preview
 */
const generateVoiceActionPreview = (actionType, args) => {
  const previews = {
    send_email: {
      voiceResponse: `I'll send an email to ${args.to} with the subject "${args.subject}". Do you want me to send it?`,
      displayText: `📧 Email to: ${args.to}\nSubject: ${args.subject}`
    },
    create_calendar_event: {
      voiceResponse: `I'll schedule "${args.title}" on ${args.date} from ${args.startTime} to ${args.endTime}. Should I create this event?`,
      displayText: `📅 Event: ${args.title}\nDate: ${args.date}\nTime: ${args.startTime} - ${args.endTime}`
    },
    create_slides: {
      voiceResponse: `I'll create a presentation called "${args.title}" for ${args.purpose}. Ready to create it?`,
      displayText: `📊 Slides: ${args.title}\nPurpose: ${args.purpose}`
    },
    create_form: {
      voiceResponse: `I'll create a form called "${args.title}" for ${args.purpose}. Should I create it?`,
      displayText: `📝 Form: ${args.title}\nPurpose: ${args.purpose}`
    },
    create_spreadsheet: {
      voiceResponse: `I'll create a spreadsheet called "${args.title}" for ${args.purpose}. Ready to create it?`,
      displayText: `📈 Spreadsheet: ${args.title}\nPurpose: ${args.purpose}`
    },
    create_task: {
      voiceResponse: `I'll add a task: "${args.title}"${args.urgency ? ` with ${args.urgency} urgency` : ''}. Should I add it?`,
      displayText: `✅ Task: ${args.title}${args.urgency ? ` [${args.urgency}]` : ''}`
    },
    create_multiple_tasks: {
      voiceResponse: `I'll add ${(args.tasks || []).length} tasks to your board. Should I add them?`,
      displayText: `✅ ${(args.tasks || []).length} tasks to add`
    }
  };
  
  return previews[actionType] || {
    voiceResponse: "I'm ready to help with that action. Should I proceed?",
    displayText: "Action ready"
  };
};

/**
 * Handle voice action approval
 */
const handleVoiceActionApproval = async (req, res, userId, session, pendingAction, actionApproved, userMessage) => {
  try {
    // Add user response to transcript
    session.transcript.push({
      speaker: 'user',
      text: userMessage,
      timestamp: new Date()
    });

    if (!actionApproved) {
      const cancelResponse = "No problem, I've cancelled that. What else can I help you with?";
      session.transcript.push({
        speaker: 'ai',
        text: cancelResponse,
        timestamp: new Date()
      });
      await session.save();
      
      return res.json({
        success: true,
        response: cancelResponse,
        actionCancelled: true
      });
    }

    // Execute the action
    const result = await executeVoiceAction(userId, pendingAction.actionType, pendingAction.actionData, session.ideaId);

    session.transcript.push({
      speaker: 'ai',
      text: result.voiceResponse,
      timestamp: new Date()
    });
    await session.save();

    return res.json({
      success: true,
      response: result.voiceResponse,
      actionCompleted: true,
      actionResult: result
    });

  } catch (error) {
    console.error('Error executing voice action:', error);
    const errorResponse = `Sorry, I couldn't complete that action. ${error.message}. Would you like to try again?`;
    
    session.transcript.push({
      speaker: 'ai',
      text: errorResponse,
      timestamp: new Date()
    });
    await session.save();

    return res.json({
      success: true,
      response: errorResponse,
      actionError: true
    });
  }
};

/**
 * Execute action from voice chat
 */
const executeVoiceAction = async (userId, actionType, actionData, ideaId) => {
  switch (actionType) {
    case 'send_email':
      return await executeVoiceSendEmail(userId, actionData, ideaId);
    case 'create_calendar_event':
      return await executeVoiceCalendarEvent(userId, actionData, ideaId);
    case 'create_slides':
      return await executeVoiceSlides(userId, actionData, ideaId);
    case 'create_form':
      return await executeVoiceForm(userId, actionData, ideaId);
    case 'create_spreadsheet':
      return await executeVoiceSpreadsheet(userId, actionData, ideaId);
    case 'create_task':
      return await executeVoiceCreateTask(userId, actionData, ideaId);
    case 'create_multiple_tasks':
      return await executeVoiceCreateMultipleTasks(userId, actionData, ideaId);
    default:
      throw new Error('Unknown action type');
  }
};

// Voice action executors
const executeVoiceSendEmail = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  
  const user = await User.findById(userId).select('googleTokens');
  const fromEmail = user.googleTokens.email;
  
  const emailContent = [
    `From: ${fromEmail}`,
    `To: ${data.to}`,
    `Subject: ${data.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    data.body
  ].join('\n');
  
  const encodedEmail = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedEmail }
  });
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'email',
    title: `Email to ${data.to.split('@')[0]}...`,
    status: 'success',
    data: { to: data.to, subject: data.subject }
  });
  
  return { 
    success: true, 
    voiceResponse: `Done! I've sent the email to ${data.to}.`
  };
};

const executeVoiceCalendarEvent = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  
  const startDateTime = `${data.date}T${data.startTime}:00`;
  const endDateTime = `${data.date}T${data.endTime}:00`;
  
  const event = {
    summary: data.title,
    description: data.description || '',
    start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  };
  
  if (data.attendees?.length) {
    event.attendees = data.attendees.map(email => ({ email }));
  }
  
  await calendar.events.insert({
    calendarId: 'primary',
    resource: event
  });
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'calendar',
    title: data.title,
    status: 'success',
    data: { date: data.date }
  });
  
  return { 
    success: true, 
    voiceResponse: `Done! I've added "${data.title}" to your calendar for ${data.date}.`
  };
};

const executeVoiceSlides = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const slides = google.slides({ version: 'v1', auth });
  
  const presentation = await slides.presentations.create({
    requestBody: { title: data.title }
  });
  
  const url = `https://docs.google.com/presentation/d/${presentation.data.presentationId}/edit`;
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'slides',
    title: data.title,
    status: 'success',
    data: { url }
  });
  
  return { 
    success: true, 
    voiceResponse: `Done! I've created your presentation "${data.title}". You can find it in your Google Drive.`,
    url
  };
};

const executeVoiceForm = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const forms = google.forms({ version: 'v1', auth });
  
  const form = await forms.forms.create({
    requestBody: {
      info: { title: data.title, documentTitle: data.title }
    }
  });
  
  const url = `https://docs.google.com/forms/d/${form.data.formId}/edit`;
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'form',
    title: data.title,
    status: 'success',
    data: { url }
  });
  
  return { 
    success: true, 
    voiceResponse: `Done! I've created your form "${data.title}". You can edit it in Google Forms.`,
    url
  };
};

const executeVoiceSpreadsheet = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const sheets = google.sheets({ version: 'v4', auth });
  
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: data.title }
    }
  });
  
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheet.data.spreadsheetId}/edit`;
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'sheets',
    title: data.title,
    status: 'success',
    data: { url }
  });
  
  return { 
    success: true, 
    voiceResponse: `Done! I've created your spreadsheet "${data.title}". You can find it in Google Sheets.`,
    url
  };
};

// Execute single task creation from voice
const executeVoiceCreateTask = async (userId, data, ideaId) => {
  const task = await Task.create({
    userId,
    ideaId,
    title: data.title,
    description: data.description || '',
    assignedToName: data.assignedToName || '',
    urgency: data.urgency || '',
    status: 'success'
  });

  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'task',
    title: `Task: ${data.title.substring(0, 50)}`,
    status: 'success',
    data: { taskId: task._id }
  });

  return {
    success: true,
    voiceResponse: `Done! I've added the task "${data.title}" to your board.`
  };
};

// Execute multiple task creation from voice
const executeVoiceCreateMultipleTasks = async (userId, data, ideaId) => {
  const tasks = data.tasks || [];
  const batchKey = `ai-voice-${Date.now()}`;
  const created = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const task = await Task.create({
      userId,
      ideaId,
      title: t.title,
      description: t.description || '',
      assignedToName: t.assignedToName || '',
      urgency: t.urgency || '',
      order: i,
      status: 'success',
      statusBatch: batchKey
    });
    created.push(task);
  }

  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'task',
    title: `${created.length} tasks created`,
    status: 'success',
    data: { taskIds: created.map(t => t._id), batchKey }
  });

  return {
    success: true,
    voiceResponse: `Done! I've added ${created.length} tasks to your board.`
  };
};

/**
 * End session and generate summary
 * POST /api/cofounder/end
 */
const endSession = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Find the session
    const session = await CofounderSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Calculate duration
    const endedAt = new Date();
    const duration = endedAt - session.startedAt;

    // Generate summary
    const { summary, completion } = await generateSummary(session);
    
    // Track summary generation API usage
    if (completion && userId) {
      await trackApiUsage(userId, completion, 'cofounder-summary');
    }

    // Update session
    session.status = 'completed';
    session.endedAt = endedAt;
    session.duration = duration;
    session.summary = summary;

    await session.save();

    res.json({
      success: true,
      session: {
        id: session._id,
        duration,
        startedAt: session.startedAt,
        endedAt,
        summary,
        ideaName: session.contextSnapshot?.idea?.name
      }
    });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
};

/**
 * Generate comprehensive meeting summary using AI
 */
const generateSummary = async (session) => {
  const summaryPrompt = `Analyze this AI co-founder meeting conversation and generate a structured summary.

MEETING CONTEXT:
- Idea: ${session.contextSnapshot?.idea?.name || 'Unknown'}
- Description: ${session.contextSnapshot?.idea?.description?.substring(0, 300) || 'N/A'}
- Duration: ${Math.round(session.duration / 60000)} minutes

CONVERSATION TRANSCRIPT:
${session.transcript.map(m => `${m.speaker.toUpperCase()}: ${m.text}`).join('\n')}

Generate a JSON summary with these sections:
1. "ideaStanding": A 2-3 sentence assessment of where the idea currently stands based on the conversation
2. "discussed": Array of 3-5 key topics that were discussed (brief bullet points)
3. "insights": Array of 2-4 key insights or realizations from the conversation
4. "whatsNew": Array of 1-3 new decisions, refinements, or changes made during the call
5. "nextSteps": Array of 2-4 action items, each with "text" and optional "priority" (high/medium/null)

Return ONLY valid JSON, no explanation:
{
  "ideaStanding": "...",
  "discussed": ["...", "..."],
  "insights": ["...", "..."],
  "whatsNew": ["...", "..."],
  "nextSteps": [{"text": "...", "priority": "high"}, {"text": "...", "priority": null}]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert at analyzing startup conversations and extracting actionable insights. Return only valid JSON.' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.5,
      max_tokens: 800
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { summary: JSON.parse(jsonMatch[0]), completion };
    }

    throw new Error('No valid JSON found in response');

  } catch (error) {
    console.error('Error generating summary:', error);
    
    // Fallback summary
    return {
      summary: {
        ideaStanding: 'Meeting completed. Summary generation encountered an issue.',
        discussed: ['Startup idea development', 'Next steps planning'],
        insights: ['Review the conversation recording for details'],
        whatsNew: [],
        nextSteps: [{ text: 'Schedule a follow-up meeting', priority: null }]
      },
      completion: null
    };
  }
};

/**
 * Get recent sessions for a user
 * GET /api/cofounder/sessions
 */
const getSessions = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { ideaId, limit = 10 } = req.query;

    const query = { userId, status: 'completed' };
    if (ideaId) {
      query.ideaId = ideaId;
    }

    const sessions = await CofounderSession.find(query)
      .sort({ endedAt: -1 })
      .limit(parseInt(limit))
      .select('_id startedAt endedAt duration contextSnapshot.idea.name summary.discussed');

    const formatted = sessions.map(s => ({
      id: s._id,
      date: s.endedAt || s.startedAt,
      duration: s.duration,
      ideaName: s.contextSnapshot?.idea?.name || 'Unknown',
      preview: s.summary?.discussed?.[0] || 'Meeting summary'
    }));

    res.json({ success: true, sessions: formatted });

  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
};

/**
 * Get a specific session with full details
 * GET /api/cofounder/sessions/:sessionId
 */
const getSession = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;

    const session = await CofounderSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      success: true,
      session: {
        id: session._id,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        duration: session.duration,
        status: session.status,
        ideaName: session.contextSnapshot?.idea?.name,
        transcript: session.transcript,
        summary: session.summary,
        emailSent: session.emailSent
      }
    });

  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
};

/**
 * Email the summary to the user
 * POST /api/cofounder/email-summary
 */
const emailSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;

    // Find the session
    const session = await CofounderSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.summary) {
      return res.status(400).json({ error: 'Session has no summary' });
    }

    // Get user info for email
    const user = await User.findById(userId);
    if (!user || !user.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Format duration
    const durationMs = session.duration || 0;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    // Send the email
    const emailResult = await sendMeetingSummaryEmail(
      user.email,
      user.name || 'there',
      session.contextSnapshot?.idea?.name || 'Your Startup',
      duration,
      session.summary
    );

    if (!emailResult.success && !emailResult.mock) {
      return res.status(500).json({ error: 'Failed to send email' });
    }

    // Mark as sent
    session.emailSent = true;
    session.emailSentAt = new Date();
    await session.save();

    res.json({ success: true, message: 'Summary email sent' });

  } catch (error) {
    console.error('Error emailing summary:', error);
    res.status(500).json({ error: 'Failed to email summary' });
  }
};

/**
 * Generate Text-to-Speech audio from text
 * POST /api/cofounder/tts
 */
const textToSpeech = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const text = maxLength(ensureString(req.body.text), 5000); // Limit to 5000 chars to prevent cost abuse

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    // Use tts-1 for faster response (lower latency), tts-1-hd for higher quality
    const ttsModel = 'tts-1';
    
    // Generate speech using OpenAI TTS - returns a Response with streaming body
    const response = await openai.audio.speech.create({
      model: ttsModel,
      voice: 'nova', // Warm, conversational voice
      input: text,
      speed: 1.05 // Slightly faster for more natural conversation flow
    });

    // Set headers for streaming audio
    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache'
    });

    // Stream the response directly to the client
    const stream = response.body;
    const reader = stream.getReader();
    
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    
    await pump();
    
    // Track TTS usage after streaming (billed by character count)
    if (userId) {
      // Don't await - track in background to not delay response
      trackAudioUsage(userId, ttsModel, { characters: text.length }, 'cofounder-tts');
    }

  } catch (error) {
    console.error('Error generating TTS:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  }
};

/**
 * Transcribe audio using OpenAI Whisper
 * POST /api/cofounder/transcribe
 */
const transcribeAudio = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Limit audio file size to 10MB to prevent cost abuse
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Audio file too large (max 10MB)' });
    }

    // Create a file object from the buffer
    const file = new File([req.file.buffer], 'audio.webm', { 
      type: req.file.mimetype 
    });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en'
    });
    
    // Track Whisper usage (billed per minute)
    // Estimate duration based on file size (rough estimate: ~10KB per second for webm)
    if (userId) {
      const estimatedSeconds = req.file.size / 10000;
      const estimatedMinutes = estimatedSeconds / 60;
      await trackAudioUsage(userId, 'whisper-1', { durationMinutes: estimatedMinutes }, 'cofounder-transcribe');
    }

    res.json({ 
      success: true, 
      text: transcription.text 
    });

  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
};

/**
 * Sync meeting insights to IdeaHub
 * POST /api/cofounder/sync-to-idea
 */
const syncToIdea = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.body;

    // Find the session
    const session = await CofounderSession.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.summary) {
      return res.status(400).json({ error: 'Session has no summary to sync' });
    }

    // Find the idea
    const idea = await Idea.findOne({
      _id: session.ideaId,
      userId
    });

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Build update summary from meeting insights
    const updateParts = [];
    
    if (session.summary.whatsNew && session.summary.whatsNew.length > 0) {
      updateParts.push('New developments: ' + session.summary.whatsNew.join('; '));
    }
    
    if (session.summary.insights && session.summary.insights.length > 0) {
      updateParts.push('Key insights: ' + session.summary.insights.slice(0, 2).join('; '));
    }

    const updateSummary = updateParts.join(' | ') || 'AI Co-Founder meeting sync';

    // Add to idea history
    idea.ideaHistory.push({
      idea: idea.idea, // Save current version before update
      updatedAt: new Date(),
      updateSource: 'ai_sync',
      updateSummary: `Co-Founder Meeting: ${updateSummary}`
    });

    idea.lastSyncedAt = new Date();
    await idea.save();

    // Mark session as synced
    session.syncedToIdeaHub = true;
    await session.save();

    res.json({ 
      success: true, 
      message: 'Meeting insights synced to IdeaHub',
      updateSummary
    });

  } catch (error) {
    console.error('Error syncing to idea:', error);
    res.status(500).json({ error: 'Failed to sync to idea' });
  }
};

/**
 * Delete a session
 * DELETE /api/cofounder/sessions/:sessionId
 */
const deleteSession = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;

    const result = await CofounderSession.deleteOne({
      _id: sessionId,
      userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, message: 'Session deleted' });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
};


/**
 * Generate Text-to-Speech audio using ElevenLabs
 * POST /api/cofounder/tts-elevenlabs
 * 
 * ElevenLabs provides higher quality, more natural voices but is more expensive.
 * Uses streaming for low latency.
 */
const textToSpeechElevenLabs = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const text = maxLength(ensureString(req.body.text), 5000); // Limit to 5000 chars to prevent cost abuse
    const rawVoiceId = ensureString(req.body.voiceId);

    console.log('[ElevenLabs TTS] Request received, text length:', text?.length);

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      console.error('[ElevenLabs TTS] ELEVENLABS_API_KEY not configured');
      return res.status(500).json({ error: 'ElevenLabs not configured' });
    }
    
    console.log('[ElevenLabs TTS] API key found, length:', ELEVENLABS_API_KEY.length);

    // Allowlist of valid ElevenLabs voice IDs to prevent SSRF
    const ALLOWED_VOICES = {
      'rachel': '21m00Tcm4TlvDq8ikWAM',
      'domi': 'AZnzlk1XvdvUeBnXmlld',
      'bella': 'EXAVITQu4vr4xnSDxMaL',
      'antoni': 'ErXwobaYiN019PkySvjV',
      'elli': 'MF3mGyEYCl7XYWbV9V6O',
      'josh': 'TxGEqnHWrfWFTfGW9XjX',
      'arnold': 'VR6AewLTigWG4xSOukaG',
      'adam': 'pNInz6obpgDQGcFmaJgB',
      'sam': 'yoZ06aMxZJJ28mfd3POQ',
    };
    // Validate voiceId: must be a known voice ID or map from name
    let selectedVoiceId = ALLOWED_VOICES['rachel']; // default
    if (rawVoiceId) {
      // Check if it's a direct allowed ID
      const isAllowedId = Object.values(ALLOWED_VOICES).includes(rawVoiceId);
      // Check if it's a name key
      const mappedId = ALLOWED_VOICES[rawVoiceId.toLowerCase()];
      if (isAllowedId) {
        selectedVoiceId = rawVoiceId;
      } else if (mappedId) {
        selectedVoiceId = mappedId;
      }
      // If neither, fall back to default (prevents SSRF via arbitrary URL path)
    }

    console.log('[ElevenLabs TTS] Using voice:', selectedVoiceId);

    // ElevenLabs streaming TTS endpoint
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5', // Fastest model with good quality
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    console.log('[ElevenLabs TTS] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs TTS] Error:', response.status, errorText);
      return res.status(response.status).json({ error: 'ElevenLabs TTS failed', details: errorText });
    }

    console.log('[ElevenLabs TTS] Success, streaming audio...');

    // Set headers for streaming audio
    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache'
    });

    // Stream the response directly to the client
    const reader = response.body.getReader();
    
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    
    await pump();
    
    // Track ElevenLabs usage (billed by character count)
    if (userId) {
      // ElevenLabs charges per character - track in background
      trackAudioUsage(userId, 'elevenlabs-turbo-v2.5', { characters: text.length }, 'cofounder-tts-elevenlabs');
    }

  } catch (error) {
    console.error('Error generating ElevenLabs TTS:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  }
};


module.exports = {
  startSession,
  sendMessage,
  endSession,
  getSessions,
  getSession,
  deleteSession,
  emailSummary,
  textToSpeech,
  textToSpeechElevenLabs,
  transcribeAudio,
  syncToIdea,
  aggregateContext // Exported for testing
};
