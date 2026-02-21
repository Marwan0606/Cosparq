const { google } = require('googleapis');
const { OpenAI } = require('openai');
const { getAuthenticatedClient } = require('./google');
const ActionLog = require('../models/ActionLog');
const Users = require('../models/Users');
const Task = require('../models/Task');
const { trackApiUsage } = require('../services/apiUsageTracker');
const { sanitizeString, maxLength, ensureString, isValidEmail, stripNewlines, isOneOf } = require('../middleware/sanitize');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============== EMAIL ACTIONS ==============

// Generate email content with AI
const generateEmail = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const emailType = isOneOf(ensureString(req.body.emailType), ['cold-outreach', 'partnership', 'investor', 'follow-up', 'introduction', 'custom'], 'custom');
    const context = sanitizeString(maxLength(ensureString(req.body.context), 2000));
    const subject = sanitizeString(maxLength(ensureString(req.body.subject), 500));
    const generateOnly = ensureString(req.body.generateOnly);
    
    if (!idea) {
      return res.status(400).json({ message: 'Idea is required' });
    }
    
    const emailTypeDescriptions = {
      'cold-outreach': 'cold outreach email to potential customers or partners',
      'partnership': 'partnership proposal email',
      'investor': 'investor pitch email',
      'follow-up': 'follow-up email after initial contact',
      'introduction': 'introduction/networking email',
      'custom': 'professional business email'
    };
    
    const typeDesc = emailTypeDescriptions[emailType] || 'professional email';
    
    let prompt = '';
    if (generateOnly === 'subject') {
      prompt = `You are a startup email expert. Generate a compelling email subject line for a ${typeDesc}.

Startup Idea: ${idea}
${context ? `Additional Context: ${context}` : ''}

Generate ONLY a short, compelling subject line (under 60 characters). No explanation, just the subject line.`;
    } else {
      prompt = `You are a startup email expert. Write a ${typeDesc} for this startup.

Startup Idea: ${idea}
${subject ? `Subject Line: ${subject}` : ''}
${context ? `Additional Context: ${context}` : ''}

Write a professional, compelling email body. Keep it concise (under 200 words). Be personable but professional.
${!subject ? 'Also include a suggested subject line at the start, formatted as "Subject: [your subject]"' : ''}

Do not include placeholders like [Your Name] - end naturally.`;
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });
    
    const response = completion.choices[0].message.content.trim();
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-generateEmail');
    
    if (generateOnly === 'subject') {
      return res.json({ subject: response });
    }
    
    // Parse subject from response if included
    let emailSubject = subject;
    let emailBody = response;
    
    if (!subject && response.toLowerCase().startsWith('subject:')) {
      const lines = response.split('\n');
      emailSubject = lines[0].replace(/^subject:\s*/i, '').trim();
      emailBody = lines.slice(1).join('\n').trim();
    }
    
    res.json({ 
      subject: emailSubject,
      body: emailBody 
    });
  } catch (error) {
    console.error('Error generating email:', error);
    res.status(500).json({ message: 'Failed to generate email' });
  }
};

// Send email via Gmail API
const sendEmail = async (req, res) => {
  try {
    const { ideaId } = req.body;
    const userId = req.user.userId;
    
    // Validate and sanitize email inputs
    const to = ensureString(req.body.to, '').trim();
    const subject = stripNewlines(sanitizeString(maxLength(ensureString(req.body.subject), 500)));
    const body = sanitizeString(maxLength(ensureString(req.body.body), 10000));
    
    if (!to || !body) {
      return res.status(400).json({ message: 'Recipient and body are required' });
    }
    
    // Validate email format
    if (!isValidEmail(to)) {
      return res.status(400).json({ message: 'Invalid recipient email address' });
    }
    
    // Get authenticated Gmail client
    const auth = await getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Get user's Google email for "From" field
    const user = await Users.findById(userId).select('googleTokens');
    const fromEmail = user.googleTokens.email;
    
    // Construct email
    const emailContent = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject || '(No subject)'}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\n');
    
    // Encode to base64url
    const encodedEmail = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Send email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });
    
    // Log the action
    await ActionLog.create({
      userId,
      ideaId: ideaId || 'general',
      type: 'email',
      title: `Email to ${to.split('@')[0]}...`,
      status: 'success',
      data: { to, subject }
    });
    
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    
    if (error.message.includes('not connected')) {
      return res.status(401).json({ message: 'Please connect your Google account first' });
    }
    
    res.status(500).json({ message: 'Failed to send email' });
  }
};

// ============== CALENDAR ACTIONS ==============

// Suggest calendar events based on idea
const suggestEvents = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    
    if (!idea) {
      return res.status(400).json({ message: 'Idea is required' });
    }
    
    const prompt = `You are a startup advisor. Based on this startup idea, suggest 3 important events/milestones to schedule.

Startup Idea: ${idea}

Return a JSON array of 3 event suggestions. Each should have:
- title: Short event title (e.g., "MVP Launch Planning", "User Interview Session")
- description: Brief description of what to do

Return ONLY valid JSON array, no other text.`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-suggestEvents');
    
    let suggestions;
    try {
      const content = completion.choices[0].message.content.trim();
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      suggestions = [
        { title: 'MVP Planning Session', description: 'Plan your minimum viable product features' },
        { title: 'Customer Discovery Call', description: 'Interview potential customers' },
        { title: 'Weekly Progress Review', description: 'Review progress and set next week goals' }
      ];
    }
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error suggesting events:', error);
    res.status(500).json({ message: 'Failed to suggest events' });
  }
};

// Create calendar event via Google Calendar API
const createEvent = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const title = sanitizeString(maxLength(ensureString(req.body.title), 500));
    const date = ensureString(req.body.date);
    const time = ensureString(req.body.time);
    const duration = ensureString(req.body.duration);
    const description = sanitizeString(maxLength(ensureString(req.body.description), 2000));
    const userId = req.user.userId;
    
    if (!title || !date || !time) {
      return res.status(400).json({ message: 'Title, date, and time are required' });
    }
    
    // Get authenticated Calendar client
    const auth = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    
    // Calculate start and end times
    const startDateTime = new Date(`${date}T${time}:00`);
    let endDateTime;
    
    if (duration === 'allday') {
      endDateTime = new Date(startDateTime);
      endDateTime.setDate(endDateTime.getDate() + 1);
    } else {
      endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);
    }
    
    // Create event
    const event = {
      summary: title,
      description: description || '',
      start: duration === 'allday' 
        ? { date: date }
        : { dateTime: startDateTime.toISOString() },
      end: duration === 'allday'
        ? { date: endDateTime.toISOString().split('T')[0] }
        : { dateTime: endDateTime.toISOString() },
    };
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    
    // Log the action
    await ActionLog.create({
      userId,
      ideaId: ideaId || 'general',
      type: 'calendar',
      title: `Event: ${title}`,
      status: 'success',
      data: { 
        eventId: response.data.id,
        title,
        date,
        time,
        link: response.data.htmlLink
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Event created',
      eventLink: response.data.htmlLink 
    });
  } catch (error) {
    console.error('Error creating event:', error);
    
    if (error.message.includes('not connected')) {
      return res.status(401).json({ message: 'Please connect your Google account first' });
    }
    
    res.status(500).json({ message: 'Failed to create calendar event' });
  }
};

// ============== CONTENT GENERATION ==============

const generateContent = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const contentType = isOneOf(ensureString(req.body.contentType), ['twitter-thread', 'linkedin-post', 'product-hunt', 'blog-outline', 'landing-copy', 'elevator-pitch'], 'landing-copy');
    const tone = isOneOf(ensureString(req.body.tone), ['professional', 'casual', 'exciting', 'informative', 'humorous'], 'professional');
    const points = sanitizeString(maxLength(ensureString(req.body.points), 2000));
    
    if (!idea || !contentType) {
      return res.status(400).json({ message: 'Idea and content type are required' });
    }
    
    const contentInstructions = {
      'twitter-thread': 'Write a compelling Twitter/X thread (5-7 tweets). Use hooks, emojis sparingly, and end with a call-to-action. Format each tweet on a new line with "1/" "2/" etc.',
      'linkedin-post': 'Write a professional LinkedIn post. Use line breaks for readability. Include a hook, story/insight, and call-to-action. Around 150-250 words.',
      'product-hunt': 'Write Product Hunt launch copy including: Tagline (under 60 chars), Description (2-3 paragraphs), and 3 key features with descriptions.',
      'blog-outline': 'Create a blog post outline with: Title, Introduction hook, 5-7 main sections with bullet points for each, and a conclusion.',
      'landing-copy': 'Write landing page copy including: Headline, Subheadline, 3 key benefits with descriptions, and a call-to-action.',
      'elevator-pitch': 'Write a 30-second elevator pitch. Clear, compelling, and memorable. Include the problem, solution, and unique value.'
    };
    
    const toneDescriptions = {
      'professional': 'professional and polished',
      'casual': 'casual and friendly',
      'exciting': 'exciting and bold with energy',
      'informative': 'informative and educational',
      'humorous': 'humorous with wit (but still professional)'
    };
    
    const prompt = `You are an expert startup content creator. 

Startup Idea: ${idea}

Create ${contentInstructions[contentType]}

Tone: ${toneDescriptions[tone] || 'professional'}
${points ? `Key Points to Include: ${points}` : ''}

Write high-quality, engaging content that would resonate with the target audience.`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.8,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-generateContent');
    
    res.json({ content: completion.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ message: 'Failed to generate content' });
  }
};

// ============== ACTION HISTORY ==============

// Get action history for an idea
const getHistory = async (req, res) => {
  try {
    const { ideaId } = req.params;
    const userId = req.user.userId;
    
    const history = await ActionLog.find({ 
      userId, 
      ideaId 
    })
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({ history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Failed to fetch action history' });
  }
};

// Log an action (for draft actions that don't use APIs)
const logAction = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const type = isOneOf(ensureString(req.body.type), ['email', 'calendar', 'content', 'slides', 'form', 'sheets', 'other'], 'other');
    const title = sanitizeString(maxLength(ensureString(req.body.title), 500));
    const data = req.body.data || {};
    const userId = req.user.userId;
    
    await ActionLog.create({
      userId,
      ideaId: ideaId || 'general',
      type,
      title,
      status: 'success',
      data: data || {}
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging action:', error);
    res.status(500).json({ message: 'Failed to log action' });
  }
};

// ============== HELPERS ==============
// API usage tracking is now handled by ../services/apiUsageTracker

// ============== AI COMPOSITION ENDPOINTS ==============

// AI composes full email from natural language prompt
const aiComposeEmail = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const prompt = sanitizeString(maxLength(ensureString(req.body.prompt), 5000));
    
    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }
    
    // Fetch user's name for email sign-off
    const userDoc = await Users.findById(req.user.userId).select('name displayName').lean();
    const userName = userDoc?.displayName || userDoc?.name || '';

    const systemPrompt = `You are an AI email composer for a startup founder. Based on the user's natural language request and their startup idea, compose a complete email.
${userName ? `
The sender's name is ${userName}. Always sign off the email using their name.` : ''}

${idea ? `The user's startup idea: ${idea}` : ''}

Extract the recipient email if mentioned, or leave blank if not specified. Generate a compelling subject line and professional email body.

IMPORTANT: Return ONLY valid JSON in this exact format, no other text:
{
  "to": "email@example.com or empty string if not specified",
  "subject": "Your subject line here",
  "body": "Your email body here"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-aiComposeEmail');
    
    let result;
    try {
      const content = completion.choices[0].message.content.trim();
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback - return the raw content as body
      result = {
        to: '',
        subject: 'About ' + (idea ? idea.substring(0, 40) : 'Your Startup'),
        body: completion.choices[0].message.content.trim()
      };
    }
    
    res.json({
      to: result.to || '',
      subject: result.subject || '',
      body: result.body || ''
    });
  } catch (error) {
    console.error('Error composing email:', error);
    res.status(500).json({ message: 'Failed to compose email' });
  }
};

// AI composes calendar event from natural language prompt
const aiComposeEvent = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const prompt = sanitizeString(maxLength(ensureString(req.body.prompt), 5000));
    
    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }
    
    // Get today's date for reference
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    const systemPrompt = `You are an AI calendar assistant for a startup founder. Based on the user's natural language request and their startup idea, create a calendar event.

${idea ? `The user's startup idea: ${idea}` : ''}

Today's date is: ${todayStr} (${dayOfWeek})

Parse dates intelligently:
- "tomorrow" = day after ${todayStr}
- "next Monday" = the coming Monday
- "in 2 days" = 2 days from ${todayStr}
- If no date mentioned, use tomorrow

For time:
- "morning" = 09:00
- "afternoon" = 14:00
- "evening" = 18:00
- If no time mentioned, default to 10:00

For duration, return one of: 30, 60, 90, 120, 180, or "allday"
Default duration is 60 minutes unless specified.

IMPORTANT: Return ONLY valid JSON in this exact format, no other text:
{
  "title": "Event title",
  "date": "YYYY-MM-DD format",
  "time": "HH:MM format (24-hour)",
  "duration": "number in minutes or 'allday'",
  "description": "Brief description of the event purpose"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.5,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-aiComposeEvent');
    
    let result;
    try {
      const content = completion.choices[0].message.content.trim();
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback defaults
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      result = {
        title: 'Startup Planning Session',
        date: tomorrow.toISOString().split('T')[0],
        time: '10:00',
        duration: '60',
        description: prompt
      };
    }
    
    res.json({
      title: result.title || 'Startup Event',
      date: result.date || '',
      time: result.time || '10:00',
      duration: String(result.duration || '60'),
      description: result.description || ''
    });
  } catch (error) {
    console.error('Error composing event:', error);
    res.status(500).json({ message: 'Failed to compose event' });
  }
};

// AI organizes calendar with multiple events
const aiOrganizeCalendar = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const prompt = sanitizeString(maxLength(ensureString(req.body.prompt), 5000));
    const userId = req.user.userId;
    
    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }
    
    // Get today's date for reference
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Get next 7 days for reference
    const nextWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      nextWeek.push({
        date: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-US', { weekday: 'long' })
      });
    }
    
    // Fetch user's tasks from Task Manager
    let tasksContext = '';
    try {
      const tasks = await Task.find({ 
        userId,
        ...(ideaId ? { ideaId } : {})
      }).sort({ order: 1 }).limit(50);
      
      if (tasks.length > 0) {
        // Group tasks by status
        const pendingTasks = tasks.filter(t => !t.completed && t.status !== 'done');
        const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
        
        tasksContext = `
USER'S TASKS FROM TASK MANAGER:
${pendingTasks.length > 0 ? `
Pending Tasks:
${pendingTasks.map(t => `- "${t.title}"${t.description ? ` (${t.description})` : ''}${t.urgency ? ` [${t.urgency} priority]` : ''}${t.date ? ` - due: ${t.date}` : ''}`).join('\n')}
` : ''}
${inProgressTasks.length > 0 ? `
In Progress:
${inProgressTasks.map(t => `- "${t.title}"${t.description ? ` (${t.description})` : ''}`).join('\n')}
` : ''}

When scheduling, prioritize these actual tasks over making up new ones. Create calendar events for these tasks with appropriate time allocations.
`;
      }
    } catch (taskError) {
      console.error('Error fetching tasks:', taskError);
      // Continue without tasks if there's an error
    }
    
    const systemPrompt = `You are an AI calendar organizer for a startup founder. Based on the user's request, their startup idea, and their actual tasks, create a schedule of multiple calendar events.

${idea ? `The user's startup idea: ${idea}` : ''}

Today's date is: ${todayStr} (${dayOfWeek})
This week's dates:
${nextWeek.map(d => `- ${d.date} (${d.day})`).join('\n')}
${tasksContext}

Guidelines:
- If the user has tasks from their Task Manager, USE THOSE ACTUAL TASKS to create calendar events
- Create between 2-10 events based on what makes sense for the request
- Space events appropriately (don't overlap, leave breaks)
- Use realistic times (9am-6pm for work, avoid weekends unless requested)
- For high priority/urgent tasks, schedule them sooner
- Estimate realistic durations based on task complexity
- For recurring activities, create individual events for each occurrence

For duration, use: 30, 60, 90, 120, or 180 (minutes)

IMPORTANT: Return ONLY a valid JSON array, no other text:
[
  {
    "title": "Event title",
    "date": "YYYY-MM-DD",
    "time": "HH:MM (24-hour)",
    "duration": "minutes as number",
    "description": "Brief description"
  }
]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-aiOrganizeCalendar');
    
    let events;
    try {
      const content = completion.choices[0].message.content.trim();
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      events = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      
      // Validate and normalize each event
      events = events.map((event, index) => ({
        id: `event-${Date.now()}-${index}`,
        title: event.title || 'Startup Event',
        date: event.date || todayStr,
        time: event.time || '10:00',
        duration: String(event.duration || '60'),
        description: event.description || '',
        selected: true // All events selected by default
      }));
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback with single default event
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      events = [{
        id: `event-${Date.now()}-0`,
        title: 'Startup Planning Session',
        date: tomorrow.toISOString().split('T')[0],
        time: '10:00',
        duration: '60',
        description: prompt,
        selected: true
      }];
    }
    
    res.json({ events });
  } catch (error) {
    console.error('Error organizing calendar:', error);
    res.status(500).json({ message: 'Failed to organize calendar' });
  }
};

// Create multiple calendar events at once
const createMultipleEvents = async (req, res) => {
  try {
    const { ideaId, events } = req.body;
    const userId = req.user.userId;
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'Events array is required' });
    }

    // Limit max events per batch
    if (events.length > 20) {
      return res.status(400).json({ message: 'Maximum 20 events per batch' });
    }
    
    // Get authenticated Calendar client
    const auth = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    
    const results = [];
    const errors = [];
    
    for (const eventData of events) {
      try {
        const { title, date, time, duration, description } = eventData;
        
        if (!title || !date || !time) {
          errors.push({ title: title || 'Unknown', error: 'Missing required fields' });
          continue;
        }
        
        // Calculate start and end times
        const startDateTime = new Date(`${date}T${time}:00`);
        let endDateTime;
        
        if (duration === 'allday') {
          endDateTime = new Date(startDateTime);
          endDateTime.setDate(endDateTime.getDate() + 1);
        } else {
          endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);
        }
        
        // Create event
        const event = {
          summary: title,
          description: description || '',
          start: duration === 'allday' 
            ? { date: date }
            : { dateTime: startDateTime.toISOString() },
          end: duration === 'allday'
            ? { date: endDateTime.toISOString().split('T')[0] }
            : { dateTime: endDateTime.toISOString() },
        };
        
        const response = await calendar.events.insert({
          calendarId: 'primary',
          resource: event,
        });
        
        results.push({
          title,
          eventId: response.data.id,
          link: response.data.htmlLink
        });
        
        // Log each action
        await ActionLog.create({
          userId,
          ideaId: ideaId || 'general',
          type: 'calendar',
          title: `Event: ${title}`,
          status: 'success',
          data: { 
            eventId: response.data.id,
            title,
            date,
            time,
            link: response.data.htmlLink
          }
        });
      } catch (eventError) {
        console.error('Error creating single event:', eventError);
        errors.push({ title: eventData.title, error: eventError.message });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Created ${results.length} events${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      created: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error creating multiple events:', error);
    
    if (error.message.includes('not connected')) {
      return res.status(401).json({ message: 'Please connect your Google account first' });
    }
    
    res.status(500).json({ message: 'Failed to create calendar events' });
  }
};

// ============== GOOGLE SLIDES ACTIONS ==============

// AI generates slide content structure
const aiGenerateSlides = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const prompt = sanitizeString(maxLength(ensureString(req.body.prompt), 5000));
    const presentationType = isOneOf(ensureString(req.body.presentationType), ['pitch-deck', 'product-demo', 'investor-update', 'team-intro', 'custom'], 'pitch-deck');
    
    if (!idea) {
      return res.status(400).json({ message: 'Idea is required' });
    }
    
    const presentationTypes = {
      'pitch-deck': 'a startup pitch deck with slides for: Problem, Solution, Market Size, Business Model, Traction, Team, and Ask',
      'product-demo': 'a product demo presentation with slides for: Overview, Key Features (3-4), How It Works, Use Cases, and Call to Action',
      'investor-update': 'an investor update with slides for: Highlights, KPIs/Metrics, Progress vs Goals, Challenges, Next Steps, and Ask',
      'team-intro': 'a team introduction deck with slides for: Company Mission, Team Overview, Individual Introductions, Culture, and Contact',
      'custom': 'a professional business presentation based on the user\'s requirements'
    };
    
    const typeDesc = presentationTypes[presentationType] || presentationTypes['pitch-deck'];
    
    const systemPrompt = `You are an expert presentation planner and content strategist. Your job is to create a detailed, well-structured slide deck outline for ${typeDesc}.

Startup Idea: ${idea}
${prompt ? `Additional Requirements: ${prompt}` : ''}

You are creating a PLANNING DOCUMENT - a detailed structure and content outline that will be turned into Google Slides. The user will then add their own designs, images, and visual polish. Your job is to provide:

1. CLEAR STRUCTURE: Plan out the exact slides needed and their optimal order
2. COMPELLING TITLES: Write attention-grabbing, specific slide titles (not generic ones)
3. DETAILED CONTENT: For each slide, provide 4-6 substantive bullet points with real content, specific details, and actionable information
4. SPEAKER GUIDANCE: Write detailed speaker notes explaining what to emphasize, how to present the slide, and key talking points

Be SPECIFIC and DETAILED. Instead of "Our solution solves the problem", write "AI-powered matching algorithm reduces search time by 80%". Instead of "Large market opportunity", write "$4.2B TAM in enterprise productivity software, growing 12% annually".

For each bullet point:
- Include specific details, numbers, or examples where relevant
- Make it presentation-ready content (not placeholder text)
- Keep each bullet under 20 words but make them substantive

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "title": "Presentation Title",
  "slides": [
    {
      "title": "Slide Title",
      "bullets": ["Detailed point 1", "Detailed point 2", "Detailed point 3", "Detailed point 4"],
      "speakerNotes": "Detailed guidance on how to present this slide, what to emphasize, and key talking points to hit."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a ${presentationType || 'pitch-deck'} presentation` }
      ],
      max_tokens: 3000,
      temperature: 0.7,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-aiGenerateSlides');
    
    let slideContent;
    try {
      const content = completion.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      slideContent = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      console.error('Failed to parse slide content:', e);
      return res.status(500).json({ message: 'Failed to generate slide content' });
    }
    
    res.json({ slideContent });
  } catch (error) {
    console.error('Error generating slides:', error);
    res.status(500).json({ message: 'Failed to generate slides' });
  }
};

// Create Google Slides presentation
const createGoogleSlides = async (req, res) => {
  try {
    const { ideaId, slideContent } = req.body;
    const userId = req.user.userId;
    
    if (!slideContent || !slideContent.slides) {
      return res.status(400).json({ message: 'Slide content is required' });
    }
    
    // Get authenticated client
    const auth = await getAuthenticatedClient(userId);
    const slides = google.slides({ version: 'v1', auth });
    
    // Create the presentation
    const presentation = await slides.presentations.create({
      requestBody: {
        title: slideContent.title || 'Startup Presentation',
      },
    });
    
    const presentationId = presentation.data.presentationId;
    
    // Get the default slide ID to delete it later
    const defaultSlideId = presentation.data.slides[0].objectId;
    
    // Build batch update requests for all slides
    const requests = [];
    
    // Create each slide
    slideContent.slides.forEach((slide, index) => {
      const slideId = `slide_${index}`;
      const titleId = `title_${index}`;
      const bodyId = `body_${index}`;
      
      // Create slide
      requests.push({
        createSlide: {
          objectId: slideId,
          insertionIndex: index,
          slideLayoutReference: {
            predefinedLayout: 'TITLE_AND_BODY',
          },
          placeholderIdMappings: [
            { layoutPlaceholder: { type: 'TITLE' }, objectId: titleId },
            { layoutPlaceholder: { type: 'BODY' }, objectId: bodyId },
          ],
        },
      });
      
      // Insert title text
      requests.push({
        insertText: {
          objectId: titleId,
          text: slide.title,
        },
      });
      
      // Insert bullet points
      const bulletText = slide.bullets.join('\n');
      requests.push({
        insertText: {
          objectId: bodyId,
          text: bulletText,
        },
      });
      
      // Add speaker notes if provided
      if (slide.speakerNotes) {
        requests.push({
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        });
      }
    });
    
    // Delete the default blank slide
    requests.push({
      deleteObject: {
        objectId: defaultSlideId,
      },
    });
    
    // Execute batch update
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });
    
    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    
    // Log the action
    await ActionLog.create({
      userId,
      ideaId: ideaId || 'general',
      type: 'slides',
      title: `Slides: ${slideContent.title}`,
      status: 'success',
      data: {
        presentationId,
        title: slideContent.title,
        slideCount: slideContent.slides.length,
        link: presentationUrl,
      },
    });
    
    res.json({
      success: true,
      presentationId,
      presentationUrl,
      slideCount: slideContent.slides.length,
    });
  } catch (error) {
    console.error('Error creating Google Slides:', error);
    
    if (error.message.includes('not connected')) {
      return res.status(401).json({ message: 'Please connect your Google account first' });
    }
    
    if (error.message.includes('insufficient authentication scopes') || error.code === 403) {
      return res.status(403).json({ message: 'Please disconnect and reconnect your Google account to grant Slides permissions' });
    }
    
    res.status(500).json({ message: 'Failed to create presentation' });
  }
};

// ============== GOOGLE FORMS ACTIONS ==============

// AI generates form structure
const aiGenerateForm = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const prompt = sanitizeString(maxLength(ensureString(req.body.prompt), 5000));
    const formType = isOneOf(ensureString(req.body.formType), ['customer-feedback', 'market-research', 'user-interview', 'beta-signup', 'feature-request', 'nps-survey', 'custom'], 'customer-feedback');
    
    if (!idea) {
      return res.status(400).json({ message: 'Idea is required' });
    }
    
    const formTypes = {
      'customer-feedback': 'a customer feedback survey to understand user satisfaction and gather improvement suggestions',
      'market-research': 'a market research questionnaire to validate the problem and understand target audience needs',
      'user-interview': 'a user interview form with questions about pain points, current solutions, and willingness to pay',
      'beta-signup': 'a beta signup form to collect interested users with their contact info and use case',
      'feature-request': 'a feature request form to prioritize what to build next based on user demand',
      'nps-survey': 'a Net Promoter Score survey with the standard NPS question and follow-up',
      'custom': 'a custom form based on the user\'s requirements'
    };
    
    const typeDesc = formTypes[formType] || formTypes['customer-feedback'];
    
    const systemPrompt = `You are an expert survey designer. Create ${typeDesc} for a startup.

Startup Idea: ${idea}
${prompt ? `Additional Requirements: ${prompt}` : ''}

Generate a form with 5-10 questions. Use a mix of question types:
- SHORT_ANSWER: For names, emails, or brief text
- PARAGRAPH: For detailed responses
- MULTIPLE_CHOICE: For single selection from options
- CHECKBOX: For multiple selections
- SCALE: For rating questions (1-5 or 1-10)

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "title": "Form Title",
  "description": "Brief description of the form's purpose",
  "questions": [
    {
      "title": "Question text",
      "type": "MULTIPLE_CHOICE",
      "required": true,
      "options": ["Option 1", "Option 2", "Option 3"]
    },
    {
      "title": "Rate your experience",
      "type": "SCALE",
      "required": true,
      "scaleMin": 1,
      "scaleMax": 5,
      "scaleLowLabel": "Not satisfied",
      "scaleHighLabel": "Very satisfied"
    },
    {
      "title": "Any additional comments?",
      "type": "PARAGRAPH",
      "required": false
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a ${formType || 'customer-feedback'} form` }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-aiGenerateForm');
    
    let formContent;
    try {
      const content = completion.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      formContent = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      console.error('Failed to parse form content:', e);
      return res.status(500).json({ message: 'Failed to generate form content' });
    }
    
    res.json({ formContent });
  } catch (error) {
    console.error('Error generating form:', error);
    res.status(500).json({ message: 'Failed to generate form' });
  }
};

// Create Google Form
const createGoogleForm = async (req, res) => {
  try {
    const { ideaId, formContent } = req.body;
    const userId = req.user.userId;
    
    if (!formContent || !formContent.questions) {
      return res.status(400).json({ message: 'Form content is required' });
    }
    
    // Get authenticated client
    const auth = await getAuthenticatedClient(userId);
    const forms = google.forms({ version: 'v1', auth });
    
    // Create the form with title
    const form = await forms.forms.create({
      requestBody: {
        info: {
          title: formContent.title || 'Survey',
          documentTitle: formContent.title || 'Survey',
        },
      },
    });
    
    const formId = form.data.formId;
    
    // Build batch update requests for questions
    const requests = [];
    
    // Add description if provided
    if (formContent.description) {
      requests.push({
        updateFormInfo: {
          info: {
            description: formContent.description,
          },
          updateMask: 'description',
        },
      });
    }
    
    // Add each question
    formContent.questions.forEach((q, index) => {
      const questionItem = {
        createItem: {
          item: {
            title: q.title,
            questionItem: {
              question: {
                required: q.required || false,
              },
            },
          },
          location: { index },
        },
      };
      
      // Set question type
      switch (q.type) {
        case 'SHORT_ANSWER':
          questionItem.createItem.item.questionItem.question.textQuestion = {
            paragraph: false,
          };
          break;
          
        case 'PARAGRAPH':
          questionItem.createItem.item.questionItem.question.textQuestion = {
            paragraph: true,
          };
          break;
          
        case 'MULTIPLE_CHOICE':
          questionItem.createItem.item.questionItem.question.choiceQuestion = {
            type: 'RADIO',
            options: (q.options || ['Option 1', 'Option 2']).map(opt => ({ value: opt })),
          };
          break;
          
        case 'CHECKBOX':
          questionItem.createItem.item.questionItem.question.choiceQuestion = {
            type: 'CHECKBOX',
            options: (q.options || ['Option 1', 'Option 2']).map(opt => ({ value: opt })),
          };
          break;
          
        case 'SCALE':
          questionItem.createItem.item.questionItem.question.scaleQuestion = {
            low: q.scaleMin || 1,
            high: q.scaleMax || 5,
            lowLabel: q.scaleLowLabel || '',
            highLabel: q.scaleHighLabel || '',
          };
          break;
          
        default:
          questionItem.createItem.item.questionItem.question.textQuestion = {
            paragraph: false,
          };
      }
      
      requests.push(questionItem);
    });
    
    // Execute batch update
    if (requests.length > 0) {
      await forms.forms.batchUpdate({
        formId,
        requestBody: { requests },
      });
    }
    
    const formUrl = `https://docs.google.com/forms/d/${formId}/edit`;
    const formResponseUrl = `https://docs.google.com/forms/d/${formId}/viewform`;
    
    // Log the action
    await ActionLog.create({
      userId,
      ideaId: ideaId || 'general',
      type: 'form',
      title: `Form: ${formContent.title}`,
      status: 'success',
      data: {
        formId,
        title: formContent.title,
        questionCount: formContent.questions.length,
        editLink: formUrl,
        responseLink: formResponseUrl,
      },
    });
    
    res.json({
      success: true,
      formId,
      editUrl: formUrl,
      responseUrl: formResponseUrl,
      questionCount: formContent.questions.length,
    });
  } catch (error) {
    console.error('Error creating Google Form:', error);
    
    if (error.message.includes('not connected')) {
      return res.status(401).json({ message: 'Please connect your Google account first' });
    }
    
    if (error.message.includes('insufficient authentication scopes') || error.code === 403) {
      return res.status(403).json({ message: 'Please disconnect and reconnect your Google account to grant Forms permissions' });
    }
    
    res.status(500).json({ message: 'Failed to create form' });
  }
};

// ============== GOOGLE SHEETS ACTIONS ==============

// AI generates spreadsheet structure
const aiGenerateSheet = async (req, res) => {
  try {
    const ideaId = ensureString(req.body.ideaId);
    const idea = maxLength(ensureString(req.body.idea), 10000);
    const prompt = sanitizeString(maxLength(ensureString(req.body.prompt), 5000));
    const sheetType = isOneOf(ensureString(req.body.sheetType), ['budget-tracker', 'task-tracker', 'competitor-analysis', 'customer-feedback', 'okr-tracker', 'sales-pipeline', 'content-calendar', 'custom'], 'task-tracker');
    
    if (!idea) {
      return res.status(400).json({ message: 'Idea is required' });
    }
    
    const sheetTypes = {
      'budget-tracker': 'a startup budget/expense tracker with categories for development, marketing, operations, salaries, and miscellaneous. Include monthly columns and totals.',
      'task-tracker': 'a project task tracker with columns for task name, assignee, status, priority, due date, and notes. Include sample tasks relevant to launching a startup.',
      'competitor-analysis': 'a competitor analysis matrix comparing features, pricing, target audience, strengths, and weaknesses across competitors.',
      'customer-feedback': 'a customer feedback tracker with columns for date, customer name/ID, feedback type, description, priority, status, and resolution.',
      'okr-tracker': 'an OKR (Objectives & Key Results) tracker with objectives, key results, progress percentage, owner, and status columns.',
      'sales-pipeline': 'a sales/leads pipeline with stages (lead, contacted, demo, proposal, negotiation, closed), company name, contact, deal value, and next steps.',
      'content-calendar': 'a content/social media calendar with date, platform, content type, topic, status, and performance metrics columns.',
      'custom': 'a custom spreadsheet based on the user\'s requirements'
    };
    
    const typeDesc = sheetTypes[sheetType] || sheetTypes['task-tracker'];
    
    const systemPrompt = `You are an expert spreadsheet designer. Create ${typeDesc} for a startup.

Startup Idea: ${idea}

Design a practical, immediately usable spreadsheet. Include:
1. Clear, descriptive column headers
2. 5-10 rows of realistic sample data that's relevant to the startup idea
3. Use appropriate data types (text, numbers, dates, percentages)

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "title": "Spreadsheet Title",
  "sheets": [
    {
      "name": "Sheet Name",
      "headers": ["Column 1", "Column 2", "Column 3"],
      "rows": [
        ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
        ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
      ]
    }
  ]
}`;

    // Build user message with their specific instructions
    let userMessage = `Create a ${sheetType || 'task-tracker'} spreadsheet for my startup.`;
    if (prompt && prompt.trim()) {
      userMessage += `\n\nMy specific requirements:\n${prompt}`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });
    
    // Track API usage
    await trackApiUsage(req.user.userId, completion, 'actions-aiGenerateSheet');
    
    let sheetContent;
    try {
      const content = completion.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      sheetContent = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      console.error('Failed to parse sheet content:', e);
      return res.status(500).json({ message: 'Failed to generate sheet content' });
    }
    
    res.json({ sheetContent });
  } catch (error) {
    console.error('Error generating sheet:', error);
    res.status(500).json({ message: 'Failed to generate sheet' });
  }
};

// Create Google Sheets spreadsheet
const createGoogleSheet = async (req, res) => {
  try {
    const { ideaId, sheetContent } = req.body;
    const userId = req.user.userId;
    
    if (!sheetContent || !sheetContent.sheets) {
      return res.status(400).json({ message: 'Sheet content is required' });
    }
    
    // Get authenticated client
    const auth = await getAuthenticatedClient(userId);
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Create the spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: sheetContent.title || 'Startup Spreadsheet',
        },
        sheets: sheetContent.sheets.map((sheet, index) => ({
          properties: {
            sheetId: index,
            title: sheet.name || `Sheet${index + 1}`,
          },
        })),
      },
    });
    
    const spreadsheetId = spreadsheet.data.spreadsheetId;
    
    // Populate each sheet with data
    const batchUpdateData = [];
    
    for (let i = 0; i < sheetContent.sheets.length; i++) {
      const sheet = sheetContent.sheets[i];
      const sheetName = sheet.name || `Sheet${i + 1}`;
      
      // Combine headers and rows
      const allData = [sheet.headers, ...sheet.rows];
      
      batchUpdateData.push({
        range: `'${sheetName}'!A1`,
        values: allData,
      });
    }
    
    // Write all data
    if (batchUpdateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: batchUpdateData,
        },
      });
    }
    
    // Format headers (bold, background color)
    const formatRequests = sheetContent.sheets.map((sheet, index) => ({
      repeatCell: {
        range: {
          sheetId: index,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.5, blue: 0.3 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
    
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    
    // Log the action
    await ActionLog.create({
      userId,
      ideaId: ideaId || 'general',
      type: 'sheets',
      title: `Sheet: ${sheetContent.title}`,
      status: 'success',
      data: {
        spreadsheetId,
        title: sheetContent.title,
        sheetCount: sheetContent.sheets.length,
        link: spreadsheetUrl,
      },
    });
    
    res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      sheetCount: sheetContent.sheets.length,
    });
  } catch (error) {
    console.error('Error creating Google Sheet:', error);
    
    if (error.message.includes('not connected')) {
      return res.status(401).json({ message: 'Please connect your Google account first' });
    }
    
    if (error.message.includes('insufficient authentication scopes') || error.code === 403) {
      return res.status(403).json({ message: 'Please disconnect and reconnect your Google account to grant Sheets permissions' });
    }
    
    res.status(500).json({ message: 'Failed to create spreadsheet' });
  }
};

module.exports = {
  generateEmail,
  sendEmail,
  suggestEvents,
  createEvent,
  generateContent,
  getHistory,
  logAction,
  aiComposeEmail,
  aiComposeEvent,
  aiOrganizeCalendar,
  createMultipleEvents,
  aiGenerateSlides,
  createGoogleSlides,
  aiGenerateForm,
  createGoogleForm,
  aiGenerateSheet,
  createGoogleSheet,
};
