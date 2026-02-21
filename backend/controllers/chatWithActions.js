/**
 * Chat with Actions Controller
 * 
 * Enhanced chat that can detect action intents and execute:
 * - Send emails via Gmail
 * - Create calendar events
 * - Generate Google Slides (planning)
 * - Create Google Forms
 * - Create Google Sheets
 * - Generate content
 */

const { OpenAI } = require('openai');
const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./google');
const { trackApiUsage } = require('../services/apiUsageTracker');
const ActionLog = require('../models/ActionLog');
const Users = require('../models/Users');
const RawChatResponseModel = require('../models/RawChat-responses');
const ChatResponseModel = require('../models/Chat-response');
const Task = require('../models/Task');
const { marked } = require('marked');
const { sanitizeString, maxLength, ensureString, ensureBoolean, isOneOf, isValidEmail, stripNewlines } = require('../middleware/sanitize');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============== ACTION TOOL DEFINITIONS ==============
const ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email via Gmail. Use when the user asks to send, draft, or compose an email to someone.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "The recipient's email address"
          },
          subject: {
            type: "string",
            description: "The email subject line"
          },
          body: {
            type: "string",
            description: "The email body content"
          }
        },
        required: ["to", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a SINGLE Google Calendar event. Use when the user wants to schedule ONE meeting, reminder, or event. For multiple events, use create_multiple_calendar_events instead.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The event title"
          },
          description: {
            type: "string",
            description: "The event description"
          },
          date: {
            type: "string",
            description: "The event date in YYYY-MM-DD format"
          },
          startTime: {
            type: "string",
            description: "Start time in HH:MM format (24-hour)"
          },
          endTime: {
            type: "string",
            description: "End time in HH:MM format (24-hour)"
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "List of attendee email addresses (optional)"
          }
        },
        required: ["title", "date", "startTime", "endTime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_multiple_calendar_events",
      description: "Create MULTIPLE Google Calendar events at once. Use this when the user wants to schedule multiple events, organize their calendar based on tasks, or create a series of events.",
      parameters: {
        type: "object",
        properties: {
          events: {
            type: "array",
            description: "Array of calendar events to create",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "The event title" },
                description: { type: "string", description: "The event description" },
                date: { type: "string", description: "The event date in YYYY-MM-DD format" },
                startTime: { type: "string", description: "Start time in HH:MM format (24-hour)" },
                endTime: { type: "string", description: "End time in HH:MM format (24-hour)" }
              },
              required: ["title", "date", "startTime", "endTime"]
            }
          }
        },
        required: ["events"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_slides",
      description: "Create a Google Slides presentation for planning and outlining. Use when user wants to create a pitch deck, presentation, or slide planning outline.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The presentation title"
          },
          purpose: {
            type: "string",
            description: "The purpose of the presentation (e.g., 'investor pitch', 'team meeting', 'product demo')"
          },
          keyPoints: {
            type: "array",
            items: { type: "string" },
            description: "Key points to cover in the presentation"
          }
        },
        required: ["title", "purpose"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_form",
      description: "Create a Google Form for surveys, feedback, or data collection. Use when user wants to create a form, survey, or questionnaire.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The form title"
          },
          purpose: {
            type: "string",
            description: "The purpose of the form (e.g., 'customer feedback', 'user research', 'waitlist signup')"
          },
          targetAudience: {
            type: "string",
            description: "Who the form is for"
          }
        },
        required: ["title", "purpose"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_spreadsheet",
      description: "Create a Google Sheets spreadsheet for tracking, planning, or data organization. Use when user wants to create a spreadsheet, tracker, or organized data table.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The spreadsheet title"
          },
          purpose: {
            type: "string",
            description: "The purpose of the spreadsheet (e.g., 'budget tracking', 'competitor analysis', 'KPI dashboard')"
          },
          columns: {
            type: "array",
            items: { type: "string" },
            description: "Suggested column headers"
          }
        },
        required: ["title", "purpose"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_content",
      description: "Generate marketing content, social media posts, blog ideas, or other written content.",
      parameters: {
        type: "object",
        properties: {
          contentType: {
            type: "string",
            enum: ["social-media", "blog-post", "marketing-copy", "tagline", "other"],
            description: "The type of content to generate"
          },
          topic: {
            type: "string",
            description: "The topic or focus of the content"
          },
          tone: {
            type: "string",
            description: "The tone/style (e.g., 'professional', 'casual', 'enthusiastic')"
          }
        },
        required: ["contentType", "topic"]
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
          title: {
            type: "string",
            description: "The task title"
          },
          description: {
            type: "string",
            description: "Detailed description of what to do"
          },
          assignedToName: {
            type: "string",
            description: "A short label for this task group (1-4 words, e.g. 'MVP Backend', 'Marketing')"
          },
          urgency: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "The urgency level of the task"
          }
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

// ============== MAIN CHAT WITH ACTIONS ==============
const chatWithActions = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch user's name for personalized responses (emails, letters, etc.)
    const userDoc = await Users.findById(userId).select('name displayName').lean();
    const userName = userDoc?.displayName || userDoc?.name || '';

    const { 
      scoreboard, 
      idea, 
      lastUserResponse, 
      lastAiResponse, 
      userInput: rawUserInput, 
      ideaId,
      // For action approval flow
      pendingAction,
      actionApproved,
      actionModification,
      // Action mode - only use tools when this is set
      actionMode
    } = req.body;

    // Sanitize text inputs
    const userInput = sanitizeString(maxLength(ensureString(rawUserInput), 5000));

    // If this is an action approval/modification response
    if (pendingAction && actionApproved !== undefined) {
      // Server-side validation of pendingAction data
      const validActionTypes = ['send_email', 'create_calendar_event', 'create_multiple_calendar_events', 'create_slides', 'create_form', 'create_spreadsheet', 'generate_content', 'create_task', 'create_multiple_tasks'];
      if (!pendingAction.actionType || !validActionTypes.includes(pendingAction.actionType)) {
        return res.status(400).json({ error: 'Invalid action type' });
      }
      if (!pendingAction.actionData || typeof pendingAction.actionData !== 'object') {
        return res.status(400).json({ error: 'Invalid action data' });
      }
      // Sanitize action data fields
      if (pendingAction.actionType === 'send_email') {
        if (!isValidEmail(ensureString(pendingAction.actionData.to))) {
          return res.status(400).json({ error: 'Invalid recipient email address' });
        }
        pendingAction.actionData.to = ensureString(pendingAction.actionData.to).trim();
        pendingAction.actionData.subject = stripNewlines(sanitizeString(maxLength(ensureString(pendingAction.actionData.subject), 500)));
        pendingAction.actionData.body = sanitizeString(maxLength(ensureString(pendingAction.actionData.body), 10000));
      }
      return handleActionApproval(req, res, userId, pendingAction, actionApproved, actionModification, ideaId);
    }

    // Fetch user's tasks for context
    let tasks = [];
    try {
      tasks = await Task.find({ userId, ideaId }).sort({ order: 1 });
    } catch (e) {
      console.log('Could not fetch tasks:', e.message);
    }

    // Format tasks for AI context
    const tasksContext = tasks.length > 0 
      ? tasks.map((t, i) => `${i+1}. [${t.completed ? '✓' : ' '}] ${t.title}${t.description ? ` - ${t.description}` : ''}${t.date ? ` (Due: ${t.date})` : ''}${t.urgency ? ` [${t.urgency}]` : ''}`).join('\n')
      : 'No tasks created yet';

    // Map actionMode to the appropriate tool
    const actionModeToTool = {
      email: 'send_email',
      calendar: 'create_calendar_event',
      slides: 'create_slides',
      sheets: 'create_spreadsheet',
      forms: 'create_form',
      content: 'generate_content'
    };

    // Get current date for the AI
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Build different system prompts based on whether action mode is active
    let systemPrompt;
    
    if (actionMode && actionModeToTool[actionMode]) {
      const toolName = actionModeToTool[actionMode];
      systemPrompt = `You are CoSparq, an AI startup co-founder assistant with FULL AUTONOMY to take actions. The user has activated ${actionMode.toUpperCase()} MODE.

TODAY'S DATE: ${currentDay} (${currentDate})
Use this date for scheduling. "Tomorrow" means ${new Date(now.getTime() + 86400000).toISOString().split('T')[0]}.

CRITICAL INSTRUCTIONS:
1. You MUST use the appropriate tool to complete the user's request
2. You have ALL the context you need - DO NOT ask for details you can generate yourself
3. If the user says "generate it for me" or "you decide" - USE YOUR JUDGMENT and create something great
4. Only ask for information you CANNOT determine from context (like a specific email address if not mentioned)
${userName ? `5. The user's name is ${userName}. ONLY sign off with their name when composing emails or letters via tools — NEVER sign off regular chat replies with "Best, ${userName}" or similar.` : ''}

CONTEXT YOU HAVE ACCESS TO:
=== STARTUP IDEA ===
${idea || 'Not specified'}

=== SCOREBOARD/ANALYSIS ===
${typeof scoreboard === 'object' ? JSON.stringify(scoreboard, null, 2) : (scoreboard || 'Not evaluated yet')}

=== USER'S TASKS ===
${tasksContext}

ACTION-SPECIFIC GUIDELINES:
${actionMode === 'email' ? `EMAIL MODE:
- If user doesn't specify a subject, GENERATE a compelling one based on context
- If user doesn't specify full body, WRITE a professional email based on their intent
- Only ASK for the recipient email if not provided
- Use the startup idea to make emails relevant and compelling` : ''}
${actionMode === 'calendar' ? `CALENDAR MODE:
- TODAY IS: ${currentDay}. Use this for scheduling!
- If user says "organize my calendar with tasks" or wants MULTIPLE events - USE create_multiple_calendar_events tool with an array of events
- For a SINGLE event - use create_calendar_event tool
- If user doesn't specify exact times, use reasonable times (9:00-10:00, 14:00-15:00, etc.)
- Use task due dates if available, otherwise schedule within the next 7 days starting from today (${currentDate})
- Generate meaningful event titles and descriptions from task context
- IMPORTANT: For multiple tasks, create ALL events in ONE tool call using create_multiple_calendar_events` : ''}
${actionMode === 'slides' ? `SLIDES MODE:
- Generate a complete presentation structure with titles and content
- Use the startup idea and scoreboard to create relevant slides
- Include speaker notes for each slide` : ''}
${actionMode === 'sheets' ? `SHEETS MODE:
- Generate complete spreadsheet structure with headers and sample data
- Use tasks or startup context to suggest relevant tracking data
- Create formulas where appropriate` : ''}
${actionMode === 'forms' ? `FORMS MODE:
- Generate complete survey questions based on the startup idea
- Include a mix of question types (multiple choice, short answer, etc.)
- Make questions relevant to customer discovery or feedback` : ''}
${actionMode === 'content' ? `CONTENT MODE:
- Generate complete content based on user request and startup context
- Use the appropriate tone and format for the content type
- Make it engaging and relevant to the startup idea` : ''}

Remember: BE AUTONOMOUS. Generate what the user needs. Only ask if something is truly impossible to determine.`;
    } else {
      // Regular chat mode - no action tools, just helpful advice
      systemPrompt = `You are CoSparq, an AI startup co-founder assistant. You help users think through their startup ideas, strategy, features, and implementation.
${userName ? `
The user's name is ${userName}. You may address them by name occasionally. However, do NOT end your chat messages with sign-offs like "Best, ${userName}" or "Regards, ${userName}" — those are only appropriate when drafting emails or letters, not in conversation.` : ''}

CONTEXT YOU HAVE ACCESS TO:
=== STARTUP IDEA ===
${idea || 'Not specified'}

=== SCOREBOARD/ANALYSIS ===
${typeof scoreboard === 'object' ? JSON.stringify(scoreboard, null, 2) : (scoreboard || 'Not evaluated yet')}

=== USER'S TASKS ===
${tasksContext}

You provide advice on:
- Technical decisions (tech stack, architecture)
- Product strategy (MVP features, prioritization)
- Market positioning
- Business model refinement
- How to improve their idea scores
- Task prioritization and planning

If the user asks to perform an action like sending an email, creating a calendar event, etc., tell them:
"To perform actions like sending emails or creating documents, click one of the action buttons above the chat (📧 Email, 📅 Calendar, etc.) and then describe what you need!"

However, if the user asks to add, create, or note down a task or to-do item, you CAN do that directly using the create_task or create_multiple_tasks tools. Do not redirect them to action buttons for task requests.

Be helpful, concise, and actionable with your advice.`;
    }

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history
    if (lastUserResponse) {
      messages.push({ role: 'user', content: lastUserResponse });
    }
    if (lastAiResponse) {
      messages.push({ role: 'assistant', content: lastAiResponse });
    }

    // Add current message
    messages.push({ role: 'user', content: userInput });

    // Only include tools if action mode is active
    const completionOptions = {
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    // Add tools only when in action mode, but always include task tools
    if (actionMode && actionModeToTool[actionMode]) {
      completionOptions.tools = ACTION_TOOLS;
      completionOptions.tool_choice = 'auto';
      completionOptions.temperature = 0.5;  // Lower temperature for more reliable tool calling
    } else {
      // Regular chat mode - still allow task creation
      const TASK_TOOLS = ACTION_TOOLS.filter(t => 
        t.function.name === 'create_task' || t.function.name === 'create_multiple_tasks'
      );
      completionOptions.tools = TASK_TOOLS;
      completionOptions.tool_choice = 'auto';
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create(completionOptions);

    // Track usage
    await trackApiUsage(userId, completion, 'chat-with-actions');

    const responseMessage = completion.choices[0].message;

    // Check if AI wants to call a tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      let args;
      
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error('Failed to parse tool arguments:', parseError);
        args = {};
      }

      console.log(`Tool called: ${functionName}`, args);  // Debug logging

      // Generate a preview for the user
      let preview;
      try {
        preview = await generateActionPreview(functionName, args, idea);
      } catch (previewError) {
        console.error('Failed to generate preview:', previewError);
        // Return a generic preview on error
        preview = {
          previewMessage: `I'll help you with that ${functionName.replace(/_/g, ' ')} action. Please confirm to proceed.`,
          previewHtml: `
            <div class="action-preview">
              <div class="preview-header"><span class="icon">✨</span> Action: ${functionName.replace(/_/g, ' ')}</div>
              <div class="preview-field">${JSON.stringify(args, null, 2)}</div>
            </div>
          `
        };
      }

      // Update the pending raw chat with AI response
      await RawChatResponseModel.findOneAndUpdate(
        { userId, ideaId, status: 'pending' },
        { AiResponse: marked(preview.previewMessage), status: 'success' },
        { new: true, runValidators: true, sort: { createdAt: -1 } }
      );

      // Save summaries to Chat-response so next message has memory
      await ChatResponseModel.findOneAndUpdate(
        { userId, ideaId },
        { userMessage: userInput.substring(0, 200), AiResponse: (preview.previewMessage || '').substring(0, 200), status: 'success' },
        { new: true, upsert: true, runValidators: true, sort: { createdAt: -1 } }
      );

      return res.json({
        type: 'action_preview',
        actionType: functionName,
        actionData: args,
        preview: preview,
        reply: preview.previewMessage,
        requiresApproval: true
      });
    }

    // Regular chat response (no action)
    const reply = responseMessage.content;

    // Update the pending raw chat with AI response
    await RawChatResponseModel.findOneAndUpdate(
      { userId, ideaId, status: 'pending' },
      { AiResponse: marked(reply), status: 'success' },
      { new: true, runValidators: true, sort: { createdAt: -1 } }
    );

    // Save summaries to Chat-response so next message has memory
    await ChatResponseModel.findOneAndUpdate(
      { userId, ideaId },
      { userMessage: userInput.substring(0, 200), AiResponse: reply.substring(0, 200), status: 'success' },
      { new: true, upsert: true, runValidators: true, sort: { createdAt: -1 } }
    );

    res.json({
      type: 'message',
      reply,
      user_summary: userInput.substring(0, 100),
      assistant_summary: reply.substring(0, 100)
    });

  } catch (error) {
    console.error('Error in chatWithActions:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
};

// ============== ACTION PREVIEW GENERATION ==============
const generateActionPreview = async (actionType, args, idea) => {
  // Safely get values with defaults
  const safeArgs = {
    to: args.to || 'Not specified',
    subject: args.subject || 'No subject',
    body: args.body || '',
    title: args.title || 'Untitled',
    date: args.date || 'Not specified',
    startTime: args.startTime || 'TBD',
    endTime: args.endTime || 'TBD',
    description: args.description || '',
    attendees: args.attendees || [],
    purpose: args.purpose || '',
    keyPoints: args.keyPoints || [],
    columns: args.columns || [],
    contentType: args.contentType || 'content',
    topic: args.topic || '',
    tone: args.tone || '',
    targetAudience: args.targetAudience || ''
  };

  const previews = {
    send_email: {
      previewMessage: `📧 **I'll send this email for you:**\n\n**To:** ${safeArgs.to}\n**Subject:** ${safeArgs.subject}\n\n${safeArgs.body}\n\n---\n*Say "Send it" to send, "Change [something]" to modify, or "Cancel" to abort.*`,
      previewHtml: `
        <div class="action-preview email-preview">
          <div class="preview-header"><span class="icon">📧</span> Email Preview</div>
          <div class="preview-field"><strong>To:</strong> ${safeArgs.to}</div>
          <div class="preview-field"><strong>Subject:</strong> ${safeArgs.subject}</div>
          <div class="preview-body">${safeArgs.body.replace(/\n/g, '<br>')}</div>
        </div>
      `
    },
    create_calendar_event: {
      previewMessage: `📅 **I'll create this calendar event:**\n\n**Event:** ${safeArgs.title}\n**Date:** ${safeArgs.date}\n**Time:** ${safeArgs.startTime} - ${safeArgs.endTime}\n${safeArgs.description ? `**Details:** ${safeArgs.description}` : ''}\n${safeArgs.attendees?.length ? `**Attendees:** ${safeArgs.attendees.join(', ')}` : ''}\n\n---\n*Say "Create it" to add to your calendar, "Change [something]" to modify, or "Cancel" to abort.*`,
      previewHtml: `
        <div class="action-preview calendar-preview">
          <div class="preview-header"><span class="icon">📅</span> Calendar Event Preview</div>
          <div class="preview-field"><strong>Event:</strong> ${safeArgs.title}</div>
          <div class="preview-field"><strong>Date:</strong> ${safeArgs.date}</div>
          <div class="preview-field"><strong>Time:</strong> ${safeArgs.startTime} - ${safeArgs.endTime}</div>
          ${safeArgs.description ? `<div class="preview-field"><strong>Details:</strong> ${safeArgs.description}</div>` : ''}
          ${safeArgs.attendees?.length ? `<div class="preview-field"><strong>Attendees:</strong> ${safeArgs.attendees.join(', ')}</div>` : ''}
        </div>
      `
    },
    create_multiple_calendar_events: (() => {
      const events = args.events || [];
      const eventsList = events.map((e, i) => `${i+1}. **${e.title}** - ${e.date} at ${e.startTime}-${e.endTime}`).join('\n');
      const eventsHtml = events.map(e => `
        <div class="preview-event-item">
          <strong>${e.title || 'Event'}</strong><br>
          <span>${e.date || 'TBD'} • ${e.startTime || '?'} - ${e.endTime || '?'}</span>
          ${e.description ? `<br><em>${e.description}</em>` : ''}
        </div>
      `).join('');
      return {
        previewMessage: `📅 **I'll create ${events.length} calendar events:**\n\n${eventsList}\n\n---\n*Say "Create them" to add all to your calendar, or "Cancel" to abort.*`,
        previewHtml: `
          <div class="action-preview calendar-preview">
            <div class="preview-header"><span class="icon">📅</span> ${events.length} Calendar Events</div>
            <div class="preview-events-list">${eventsHtml}</div>
          </div>
        `
      };
    })(),
    create_slides: {
      previewMessage: `📊 **I'll create a presentation planning outline:**\n\n**Title:** ${safeArgs.title}\n**Purpose:** ${safeArgs.purpose}\n${safeArgs.keyPoints?.length ? `**Key Points:**\n${safeArgs.keyPoints.map(p => `• ${p}`).join('\n')}` : ''}\n\n---\n*Say "Create it" to generate the Google Slides, "Change [something]" to modify, or "Cancel" to abort.*`,
      previewHtml: `
        <div class="action-preview slides-preview">
          <div class="preview-header"><span class="icon">📊</span> Slides Planning Preview</div>
          <div class="preview-field"><strong>Title:</strong> ${safeArgs.title}</div>
          <div class="preview-field"><strong>Purpose:</strong> ${safeArgs.purpose}</div>
          ${safeArgs.keyPoints?.length ? `<div class="preview-field"><strong>Key Points:</strong><ul>${safeArgs.keyPoints.map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}
        </div>
      `
    },
    create_form: {
      previewMessage: `📝 **I'll create a Google Form:**\n\n**Title:** ${safeArgs.title}\n**Purpose:** ${safeArgs.purpose}\n${safeArgs.targetAudience ? `**Target Audience:** ${safeArgs.targetAudience}` : ''}\n\n---\n*Say "Create it" to generate the form, "Change [something]" to modify, or "Cancel" to abort.*`,
      previewHtml: `
        <div class="action-preview form-preview">
          <div class="preview-header"><span class="icon">📝</span> Form Preview</div>
          <div class="preview-field"><strong>Title:</strong> ${safeArgs.title}</div>
          <div class="preview-field"><strong>Purpose:</strong> ${safeArgs.purpose}</div>
          ${safeArgs.targetAudience ? `<div class="preview-field"><strong>Audience:</strong> ${safeArgs.targetAudience}</div>` : ''}
        </div>
      `
    },
    create_spreadsheet: {
      previewMessage: `📈 **I'll create a Google Spreadsheet:**\n\n**Title:** ${safeArgs.title}\n**Purpose:** ${safeArgs.purpose}\n${safeArgs.columns?.length ? `**Columns:** ${safeArgs.columns.join(', ')}` : ''}\n\n---\n*Say "Create it" to generate the spreadsheet, "Change [something]" to modify, or "Cancel" to abort.*`,
      previewHtml: `
        <div class="action-preview sheets-preview">
          <div class="preview-header"><span class="icon">📈</span> Spreadsheet Preview</div>
          <div class="preview-field"><strong>Title:</strong> ${safeArgs.title}</div>
          <div class="preview-field"><strong>Purpose:</strong> ${safeArgs.purpose}</div>
          ${safeArgs.columns?.length ? `<div class="preview-field"><strong>Columns:</strong> ${safeArgs.columns.join(', ')}</div>` : ''}
        </div>
      `
    },
    generate_content: {
      previewMessage: `✍️ **I'll generate ${safeArgs.contentType} content:**\n\n**Topic:** ${safeArgs.topic}\n${safeArgs.tone ? `**Tone:** ${safeArgs.tone}` : ''}\n\n---\n*Say "Generate it" to create the content, "Change [something]" to modify, or "Cancel" to abort.*`,
      previewHtml: `
        <div class="action-preview content-preview">
          <div class="preview-header"><span class="icon">✍️</span> Content Preview</div>
          <div class="preview-field"><strong>Type:</strong> ${safeArgs.contentType}</div>
          <div class="preview-field"><strong>Topic:</strong> ${safeArgs.topic}</div>
          ${safeArgs.tone ? `<div class="preview-field"><strong>Tone:</strong> ${safeArgs.tone}</div>` : ''}
        </div>
      `
    },
    create_task: {
      previewMessage: `✅ **I'll add this task to your board:**\n\n**Task:** ${safeArgs.title}\n${safeArgs.description ? `**Details:** ${safeArgs.description}` : ''}\n${safeArgs.urgency ? `**Urgency:** ${safeArgs.urgency}` : ''}\n${safeArgs.assignedToName ? `**Group:** ${safeArgs.assignedToName}` : ''}\n\n---\n*Say "Add it" to create the task, "Change [something]" to modify, or "Cancel" to abort.*`,
      previewHtml: `
        <div class="action-preview task-preview">
          <div class="preview-header"><span class="icon">✅</span> Task Preview</div>
          <div class="preview-field"><strong>Task:</strong> ${safeArgs.title}</div>
          ${safeArgs.description ? `<div class="preview-field"><strong>Details:</strong> ${safeArgs.description}</div>` : ''}
          ${safeArgs.urgency ? `<div class="preview-field"><strong>Urgency:</strong> ${safeArgs.urgency}</div>` : ''}
          ${safeArgs.assignedToName ? `<div class="preview-field"><strong>Group:</strong> ${safeArgs.assignedToName}</div>` : ''}
        </div>
      `
    },
    create_multiple_tasks: (() => {
      const tasksList = (args.tasks || []).map((t, i) => `${i+1}. **${t.title}**${t.urgency ? ` [${t.urgency}]` : ''}`).join('\n');
      const tasksHtml = (args.tasks || []).map(t => `
        <div class="preview-event-item">
          <strong>${t.title || 'Task'}</strong>
          ${t.description ? `<br><em>${t.description}</em>` : ''}
          ${t.urgency ? `<br><span class="tm-badge">${t.urgency}</span>` : ''}
        </div>
      `).join('');
      return {
        previewMessage: `✅ **I'll add ${(args.tasks || []).length} tasks to your board:**\n\n${tasksList}\n\n---\n*Say "Add them" to create all tasks, or "Cancel" to abort.*`,
        previewHtml: `
          <div class="action-preview task-preview">
            <div class="preview-header"><span class="icon">✅</span> ${(args.tasks || []).length} Tasks</div>
            <div class="preview-events-list">${tasksHtml}</div>
          </div>
        `
      };
    })()
  };

  return previews[actionType] || {
    previewMessage: `I'll help you with that action. Please confirm to proceed.`,
    previewHtml: `<div class="action-preview">Action ready</div>`
  };
};

// ============== ACTION APPROVAL HANDLER ==============
const handleActionApproval = async (req, res, userId, pendingAction, actionApproved, actionModification, ideaId) => {
  try {
    if (!actionApproved) {
      // User cancelled - save cancellation message
      const cancelMessage = "No problem! I've cancelled that action. What else can I help you with?";
      
      await RawChatResponseModel.findOneAndUpdate(
        { userId, ideaId, status: 'pending' },
        { AiResponse: cancelMessage, status: 'success' },
        { new: true, runValidators: true, sort: { createdAt: -1 } }
      );
      
      return res.json({
        type: 'message',
        reply: cancelMessage
      });
    }

    // If there's a modification, we need to regenerate
    if (actionModification) {
      // Re-run the chat to get updated action
      return res.json({
        type: 'message',
        reply: `Got it, let me update that. ${actionModification}`,
        needsRegeneration: true
      });
    }

    // Execute the approved action
    const result = await executeAction(userId, pendingAction.actionType, pendingAction.actionData, ideaId);

    // Save the success/error message to chat history
    const successHtml = result.success 
      ? `<div class="action-success">${result.message}</div>${result.eventLink || result.url ? `<a href="${result.eventLink || result.url}" target="_blank" class="action-link">Open →</a>` : ''}`
      : `<div class="action-error">${result.message}</div>`;
    
    await RawChatResponseModel.findOneAndUpdate(
      { userId, ideaId, status: 'pending' },
      { AiResponse: successHtml, status: 'success' },
      { new: true, runValidators: true, sort: { createdAt: -1 } }
    );

    return res.json({
      type: 'action_completed',
      reply: result.message,
      actionResult: result
    });

  } catch (error) {
    console.error('Error handling action approval:', error);
    
    // Save error message to chat history
    const errorMessage = `Sorry, I couldn't complete that action: ${error.message}. Would you like to try again?`;
    await RawChatResponseModel.findOneAndUpdate(
      { userId, ideaId, status: 'pending' },
      { AiResponse: `<div class="action-error">${errorMessage}</div>`, status: 'success' },
      { new: true, runValidators: true, sort: { createdAt: -1 } }
    );
    
    return res.json({
      type: 'action_error',
      reply: errorMessage
    });
  }
};

// ============== ACTION EXECUTION ==============
const executeAction = async (userId, actionType, actionData, ideaId) => {
  switch (actionType) {
    case 'send_email':
      return await executeSendEmail(userId, actionData, ideaId);
    case 'create_calendar_event':
      return await executeCreateCalendarEvent(userId, actionData, ideaId);
    case 'create_multiple_calendar_events':
      return await executeCreateMultipleCalendarEvents(userId, actionData, ideaId);
    case 'create_slides':
      return await executeCreateSlides(userId, actionData, ideaId);
    case 'create_form':
      return await executeCreateForm(userId, actionData, ideaId);
    case 'create_spreadsheet':
      return await executeCreateSpreadsheet(userId, actionData, ideaId);
    case 'generate_content':
      return await executeGenerateContent(userId, actionData, ideaId);
    case 'create_task':
      return await executeCreateTask(userId, actionData, ideaId);
    case 'create_multiple_tasks':
      return await executeCreateMultipleTasks(userId, actionData, ideaId);
    default:
      throw new Error('Unknown action type');
  }
};

// Execute email send
const executeSendEmail = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });
  
  const user = await Users.findById(userId).select('googleTokens');
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
  
  return { success: true, message: `✅ Email sent to ${data.to}!` };
};

// Execute calendar event creation
const executeCreateCalendarEvent = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  
  const startDateTime = `${data.date}T${data.startTime}:00`;
  const endDateTime = `${data.date}T${data.endTime}:00`;
  
  const event = {
    summary: data.title,
    description: data.description || '',
    start: {
      dateTime: startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };
  
  if (data.attendees?.length) {
    event.attendees = data.attendees.map(email => ({ email }));
  }
  
  const created = await calendar.events.insert({
    calendarId: 'primary',
    resource: event
  });
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'calendar',
    title: data.title,
    status: 'success',
    data: { eventId: created.data.id, date: data.date }
  });
  
  return { 
    success: true, 
    message: `✅ Event "${data.title}" added to your calendar for ${data.date}!`,
    eventLink: created.data.htmlLink
  };
};

// Execute multiple calendar events creation
const executeCreateMultipleCalendarEvents = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  
  const events = data.events || [];
  const results = [];
  const errors = [];
  
  for (const eventData of events) {
    try {
      const startDateTime = `${eventData.date}T${eventData.startTime}:00`;
      const endDateTime = `${eventData.date}T${eventData.endTime}:00`;
      
      const event = {
        summary: eventData.title,
        description: eventData.description || '',
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };
      
      const created = await calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });
      
      results.push({
        title: eventData.title,
        date: eventData.date,
        link: created.data.htmlLink
      });
      
      // Log each event
      await ActionLog.create({
        userId,
        ideaId: ideaId || 'general',
        type: 'calendar',
        title: eventData.title,
        status: 'success',
        data: { eventId: created.data.id, date: eventData.date }
      });
    } catch (err) {
      console.error(`Failed to create event "${eventData.title}":`, err.message);
      errors.push({ title: eventData.title, error: err.message });
    }
  }
  
  const successCount = results.length;
  const errorCount = errors.length;
  
  if (errorCount === 0) {
    return {
      success: true,
      message: `✅ Created ${successCount} calendar events successfully!`,
      events: results
    };
  } else if (successCount > 0) {
    return {
      success: true,
      message: `✅ Created ${successCount} events. ⚠️ ${errorCount} failed.`,
      events: results,
      errors
    };
  } else {
    return {
      success: false,
      message: `❌ Failed to create events: ${errors.map(e => e.title).join(', ')}`,
      errors
    };
  }
};

// Execute slides creation
const executeCreateSlides = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const slides = google.slides({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });
  
  // Get user's idea context
  const user = await Users.findById(userId);
  
  // Generate slide content with AI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Create a presentation planning outline for: "${data.title}"
Purpose: ${data.purpose}
${data.keyPoints?.length ? `Key points to cover: ${data.keyPoints.join(', ')}` : ''}

Generate 5-7 slides with:
1. Title + subtitle for each slide
2. 2-4 bullet points per slide
3. Speaker notes

Format as JSON array:
[{
  "slideTitle": "...",
  "subtitle": "...",
  "bullets": ["...", "..."],
  "speakerNotes": "..."
}]`
    }],
    response_format: { type: 'json_object' },
    max_tokens: 1500
  });
  
  await trackApiUsage(userId, completion, 'chat-action-slides');
  
  let slideContent;
  try {
    const parsed = JSON.parse(completion.choices[0].message.content);
    slideContent = parsed.slides || parsed;
  } catch (e) {
    throw new Error('Failed to generate slide content');
  }
  
  // Create presentation
  const presentation = await slides.presentations.create({
    requestBody: { title: data.title }
  });
  
  const presentationId = presentation.data.presentationId;
  
  // Build slide requests
  const requests = [];
  
  // Update title slide
  requests.push({
    updateTextStyle: {
      objectId: presentation.data.slides[0].pageElements[0]?.objectId,
      textRange: { type: 'ALL' },
      style: { fontSize: { magnitude: 44, unit: 'PT' } },
      fields: 'fontSize'
    }
  });
  
  // Create additional slides
  for (let i = 0; i < slideContent.length; i++) {
    const slide = slideContent[i];
    
    requests.push({
      createSlide: {
        insertionIndex: i + 1,
        slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' }
      }
    });
  }
  
  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: { requests }
  });
  
  // Get updated presentation to get new slide IDs
  const updated = await slides.presentations.get({ presentationId });
  
  // Add content to each slide
  const contentRequests = [];
  for (let i = 1; i < updated.data.slides.length && i <= slideContent.length; i++) {
    const slideData = slideContent[i - 1];
    const slideObj = updated.data.slides[i];
    
    const titleElement = slideObj.pageElements?.find(e => e.shape?.placeholder?.type === 'TITLE');
    const bodyElement = slideObj.pageElements?.find(e => e.shape?.placeholder?.type === 'BODY');
    
    if (titleElement) {
      contentRequests.push({
        insertText: {
          objectId: titleElement.objectId,
          text: slideData.slideTitle
        }
      });
    }
    
    if (bodyElement && slideData.bullets?.length) {
      contentRequests.push({
        insertText: {
          objectId: bodyElement.objectId,
          text: slideData.bullets.join('\n')
        }
      });
    }
  }
  
  if (contentRequests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: contentRequests }
    });
  }
  
  const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'slides',
    title: data.title,
    status: 'success',
    data: { presentationId, url: presentationUrl }
  });
  
  return {
    success: true,
    message: `✅ Presentation "${data.title}" created! [Open in Google Slides](${presentationUrl})`,
    url: presentationUrl
  };
};

// Execute form creation
const executeCreateForm = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const forms = google.forms({ version: 'v1', auth });
  
  // Generate form questions with AI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Create a Google Form for: "${data.title}"
Purpose: ${data.purpose}
Target audience: ${data.targetAudience || 'General'}

Generate 5-8 relevant questions. Format as JSON:
{
  "description": "Form description",
  "questions": [
    { "title": "Question text", "type": "TEXT|PARAGRAPH|MULTIPLE_CHOICE|CHECKBOX|SCALE", "options": ["opt1", "opt2"], "required": true }
  ]
}`
    }],
    response_format: { type: 'json_object' },
    max_tokens: 1000
  });
  
  await trackApiUsage(userId, completion, 'chat-action-form');
  
  const formContent = JSON.parse(completion.choices[0].message.content);
  
  // Create form
  const form = await forms.forms.create({
    requestBody: {
      info: {
        title: data.title,
        documentTitle: data.title
      }
    }
  });
  
  // Add questions
  const requests = [];
  
  if (formContent.description) {
    requests.push({
      updateFormInfo: {
        info: { description: formContent.description },
        updateMask: 'description'
      }
    });
  }
  
  formContent.questions?.forEach((q, index) => {
    const questionItem = {
      createItem: {
        item: {
          title: q.title,
          questionItem: {
            question: {
              required: q.required || false
            }
          }
        },
        location: { index }
      }
    };
    
    switch (q.type) {
      case 'PARAGRAPH':
        questionItem.createItem.item.questionItem.question.textQuestion = { paragraph: true };
        break;
      case 'MULTIPLE_CHOICE':
        questionItem.createItem.item.questionItem.question.choiceQuestion = {
          type: 'RADIO',
          options: q.options?.map(o => ({ value: o })) || [{ value: 'Option 1' }]
        };
        break;
      case 'CHECKBOX':
        questionItem.createItem.item.questionItem.question.choiceQuestion = {
          type: 'CHECKBOX',
          options: q.options?.map(o => ({ value: o })) || [{ value: 'Option 1' }]
        };
        break;
      case 'SCALE':
        questionItem.createItem.item.questionItem.question.scaleQuestion = {
          low: 1,
          high: 5,
          lowLabel: 'Not at all',
          highLabel: 'Very much'
        };
        break;
      default:
        questionItem.createItem.item.questionItem.question.textQuestion = { paragraph: false };
    }
    
    requests.push(questionItem);
  });
  
  if (requests.length > 0) {
    await forms.forms.batchUpdate({
      formId: form.data.formId,
      requestBody: { requests }
    });
  }
  
  const formUrl = form.data.responderUri;
  const editUrl = `https://docs.google.com/forms/d/${form.data.formId}/edit`;
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'form',
    title: data.title,
    status: 'success',
    data: { formId: form.data.formId, url: editUrl }
  });
  
  return {
    success: true,
    message: `✅ Form "${data.title}" created! [Edit Form](${editUrl}) | [Share Link](${formUrl})`,
    url: editUrl,
    shareUrl: formUrl
  };
};

// Execute spreadsheet creation
const executeCreateSpreadsheet = async (userId, data, ideaId) => {
  const auth = await getAuthenticatedClient(userId);
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Generate spreadsheet structure with AI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Create a Google Sheets structure for: "${data.title}"
Purpose: ${data.purpose}
${data.columns?.length ? `Suggested columns: ${data.columns.join(', ')}` : ''}

Generate the spreadsheet structure as JSON:
{
  "headers": ["Column1", "Column2", ...],
  "sampleRows": [["val1", "val2", ...], ...],
  "formatting": { "headerColor": "#hex", "alternateRowColor": "#hex" }
}`
    }],
    response_format: { type: 'json_object' },
    max_tokens: 800
  });
  
  await trackApiUsage(userId, completion, 'chat-action-sheets');
  
  const sheetContent = JSON.parse(completion.choices[0].message.content);
  
  // Create spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: data.title },
      sheets: [{
        properties: { title: 'Sheet1' }
      }]
    }
  });
  
  const spreadsheetId = spreadsheet.data.spreadsheetId;
  const sheetId = spreadsheet.data.sheets[0].properties.sheetId;
  
  // Add headers and data
  const values = [sheetContent.headers];
  if (sheetContent.sampleRows?.length) {
    values.push(...sheetContent.sampleRows);
  }
  
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: { values }
  });
  
  // Apply formatting
  const requests = [{
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)'
    }
  }];
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
  
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'sheets',
    title: data.title,
    status: 'success',
    data: { spreadsheetId, url: sheetUrl }
  });
  
  return {
    success: true,
    message: `✅ Spreadsheet "${data.title}" created! [Open in Google Sheets](${sheetUrl})`,
    url: sheetUrl
  };
};

// Execute content generation
const executeGenerateContent = async (userId, data, ideaId) => {
  const contentPrompts = {
    'social-media': `Write 3 engaging social media posts about: ${data.topic}. Tone: ${data.tone || 'professional'}. Include hashtags.`,
    'blog-post': `Write a compelling blog post outline with intro paragraph about: ${data.topic}. Tone: ${data.tone || 'informative'}.`,
    'marketing-copy': `Write persuasive marketing copy for: ${data.topic}. Tone: ${data.tone || 'compelling'}. Include a headline and body.`,
    'tagline': `Generate 5 catchy taglines/slogans for: ${data.topic}. Tone: ${data.tone || 'memorable'}.`,
    'other': `Write content about: ${data.topic}. Tone: ${data.tone || 'professional'}.`
  };
  
  const prompt = contentPrompts[data.contentType] || contentPrompts.other;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000
  });
  
  await trackApiUsage(userId, completion, 'chat-action-content');
  
  const content = completion.choices[0].message.content;
  
  await ActionLog.create({
    userId,
    ideaId: ideaId || 'general',
    type: 'content',
    title: `${data.contentType}: ${data.topic.substring(0, 30)}...`,
    status: 'success',
    data: { contentType: data.contentType, topic: data.topic }
  });
  
  return {
    success: true,
    message: `✍️ Here's your ${data.contentType} content:\n\n${content}`,
    content
  };
};

// Execute single task creation
const executeCreateTask = async (userId, data, ideaId) => {
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
    message: `✅ Task added: **${data.title}**${data.urgency ? ` [${data.urgency}]` : ''}`
  };
};

// Execute multiple task creation
const executeCreateMultipleTasks = async (userId, data, ideaId) => {
  const tasks = data.tasks || [];
  const batchKey = `ai-chat-${Date.now()}`;
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

  const taskList = created.map((t, i) => `${i+1}. ${t.title}`).join('\n');
  return {
    success: true,
    message: `✅ Added ${created.length} tasks to your board:\n\n${taskList}`
  };
};

module.exports = {
  chatWithActions,
  ACTION_TOOLS
};
