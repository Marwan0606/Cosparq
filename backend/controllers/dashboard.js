const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const Idea = require('../models/Idea-pitch-responses');
const ChatHistory = require('../models/Chat-response');
const ScoreboardResponse = require('../models/Scoreboard-responses');
const MarketResponse = require('../models/Market-responses');
const Task = require('../models/Task');
const BrainstormSession = require('../models/BrainstormSession');

/**
 * Get dashboard data - aggregates all info for a magical AI-powered dashboard
 */
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;

    // Fetch all data in parallel
    const [idea, scoreboard, marketResearch, recentChats, tasks, brainstormSessions] = await Promise.all([
      Idea.findOne({ userId, _id: ideaId }),
      ScoreboardResponse.findOne({ userId, ideaId }),
      MarketResponse.findOne({ userId, ideaId }),
      ChatHistory.find({ userId, ideaId }).sort({ createdAt: -1 }).limit(10),
      Task.find({ userId, ideaId }).sort({ createdAt: -1 }).limit(10),
      BrainstormSession.find({ userId, projectId: ideaId }).sort({ updatedAt: -1 }).limit(5)
    ]);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Parse scoreboard data if exists
    let scoreData = null;
    if (scoreboard?.scoreboardResponse) {
      try {
        scoreData = JSON.parse(scoreboard.scoreboardResponse);
      } catch (e) {
        console.log('Failed to parse scoreboard');
      }
    }

    // Parse market research if exists
    let marketData = null;
    if (marketResearch?.marketResponse) {
      try {
        marketData = JSON.parse(marketResearch.marketResponse);
      } catch (e) {
        console.log('Failed to parse market research');
      }
    }

    // Calculate analytics
    const analytics = {
      totalChats: recentChats.length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length,
      hasScoreboard: !!scoreData,
      hasMarketResearch: !!marketData,
      ideaAge: Math.floor((Date.now() - new Date(idea.createdAt)) / (1000 * 60 * 60 * 24)), // days
      lastActivity: getLastActivity(idea, scoreboard, marketResearch, recentChats, brainstormSessions)
    };

    // Determine what's missing/outdated for smart recommendations
    const recommendations = generateRecommendations(idea, scoreData, marketData, recentChats, tasks);

    // Build response
    res.json({
      idea: {
        _id: idea._id,
        name: idea.ideaName,
        description: idea.idea,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt,
        lastSyncedAt: idea.lastSyncedAt
      },
      scoreboard: scoreData ? {
        overall: scoreData.Overall?.score || scoreData.overall_score || scoreData.overallScore || 0,
        metrics: extractMetrics(scoreData),
        updatedAt: scoreboard.updatedAt
      } : null,
      marketResearch: marketData ? {
        summary: extractMarketSummary(marketData),
        updatedAt: marketResearch.updatedAt
      } : null,
      recentActivity: formatRecentActivity(recentChats, tasks, brainstormSessions, idea),
      analytics,
      recommendations,
      quickActions: generateQuickActions(scoreData, marketData, recentChats)
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
};

/**
 * Generate AI greeting and insights for the dashboard
 */
const getDashboardAIInsights = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ideaId } = req.params;

    // Fetch context data
    const [idea, scoreboard, marketResearch, recentChats] = await Promise.all([
      Idea.findOne({ userId, _id: ideaId }),
      ScoreboardResponse.findOne({ userId, ideaId }),
      MarketResponse.findOne({ userId, ideaId }),
      ChatHistory.find({ userId, ideaId }).sort({ createdAt: -1 }).limit(5)
    ]);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Get time of day for greeting
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    // Parse scoreboard
    let scoreData = null;
    if (scoreboard?.scoreboardResponse) {
      try {
        scoreData = JSON.parse(scoreboard.scoreboardResponse);
      } catch (e) {}
    }

    // Build context for AI
    const context = {
      ideaName: idea.ideaName,
      ideaDescription: idea.idea?.substring(0, 500),
      hasScoreboard: !!scoreData,
      overallScore: scoreData?.overall_score || scoreData?.overallScore,
      hasMarketResearch: !!marketResearch?.marketResponse,
      recentChatCount: recentChats.length,
      daysSinceCreation: Math.floor((Date.now() - new Date(idea.createdAt)) / (1000 * 60 * 60 * 24))
    };

    const messages = [
      {
        role: "system",
        content: `You are an enthusiastic AI co-founder helping a startup founder. Generate a short, personalized dashboard greeting and one key insight/recommendation.

Be warm, motivating, and specific. Keep it brief (2-3 sentences max for greeting, 1 sentence for the insight).

Return JSON only:
{
  "greeting": "<personalized greeting mentioning their idea by name>",
  "insight": "<one specific, actionable insight or encouragement>",
  "focusSuggestion": "<what they should work on today - be specific>",
  "motivationalQuote": "<a relevant startup/entrepreneurship quote>"
}`
      },
      {
        role: "user",
        content: `Time: ${timeGreeting}
Idea: "${context.ideaName}"
Description: ${context.ideaDescription || 'Not yet defined'}
Has Scoreboard: ${context.hasScoreboard} ${context.overallScore ? `(Score: ${context.overallScore}/100)` : ''}
Has Market Research: ${context.hasMarketResearch}
Recent Chats: ${context.recentChatCount}
Days Active: ${context.daysSinceCreation}

Generate a personalized, motivating dashboard message.`
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7
    });

    await trackApiUsage(userId, response, 'dashboardInsights');

    let result;
    try {
      let reply = response.choices[0].message.content.trim();
      if (reply.startsWith('```')) {
        reply = reply.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      result = JSON.parse(reply);
    } catch (e) {
      result = {
        greeting: `${timeGreeting}! Welcome back to ${idea.ideaName}. Your AI co-founder is ready to help.`,
        insight: "Let's make today count. Every step forward matters.",
        focusSuggestion: "Review your idea and consider what's next.",
        motivationalQuote: "The best time to plant a tree was 20 years ago. The second best time is now."
      };
    }

    res.json({
      timeGreeting,
      ...result
    });

  } catch (error) {
    console.error('Dashboard AI insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
};

// Helper functions

function getLastActivity(idea, scoreboard, marketResearch, chats, brainstormSessions) {
  const dates = [
    idea.updatedAt,
    scoreboard?.updatedAt,
    marketResearch?.updatedAt,
    chats[0]?.createdAt,
    brainstormSessions?.[0]?.updatedAt
  ].filter(Boolean);
  
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map(d => new Date(d))));
}

function extractMetrics(scoreData) {
  if (!scoreData) return {};
  
  // Handle the actual scoreboard structure: { "Originality": { score: X, justification: "..." }, ... }
  const result = {};
  
  // Map of scoreboard keys to our metric names
  const keyMap = {
    'Originality': 'innovation',
    'Market Demand': 'marketPotential',
    'Technical Feasibility': 'feasibility',
    'Scalability': 'scalability',
    'Barrier to Entry': 'barrierToEntry',
    'Monetization Potential': 'monetization',
    'Regulatory & Legal Complexity': 'legal'
  };
  
  for (const [scoreKey, metricKey] of Object.entries(keyMap)) {
    if (scoreData[scoreKey]?.score !== undefined) {
      result[metricKey] = Math.round(scoreData[scoreKey].score); // Keep actual 0-100 value
    }
  }
  
  return result;
}

function extractMarketSummary(marketData) {
  if (!marketData) return null;
  
  return {
    competitors: marketData.competitors?.slice(0, 3) || [],
    marketSize: marketData.market_size || marketData.marketSize,
    opportunity: marketData.opportunity || marketData.summary
  };
}

function formatRecentActivity(chats, tasks, brainstormSessions, idea) {
  const activities = [];
  
  // Add recent chats
  chats.slice(0, 3).forEach(chat => {
    if (chat.createdAt) {
      activities.push({
        type: 'chat',
        icon: 'chat',
        title: 'Chat Agent',
        description: chat.userMessage?.substring(0, 60) + '...',
        timestamp: new Date(chat.createdAt).getTime()
      });
    }
  });
  
  // Add recent tasks
  tasks.slice(0, 3).forEach(task => {
    if (task.createdAt) {
      activities.push({
        type: 'task',
        icon: task.completed ? 'check' : 'tasks',
        title: task.completed ? 'Task Completed' : 'Task Added',
        description: task.title?.substring(0, 60),
        timestamp: new Date(task.createdAt).getTime()
      });
    }
  });
  
  // Add recent brainstorm sessions
  if (brainstormSessions && brainstormSessions.length > 0) {
    brainstormSessions.slice(0, 3).forEach(session => {
      const ts = session.updatedAt || session.createdAt;
      if (ts) {
        activities.push({
          type: 'brainstorm',
          icon: 'brainstorm',
          title: 'Brainstorm Session',
          description: session.name || 'Ideation session',
          timestamp: new Date(ts).getTime()
        });
      }
    });
  }
  
  // Sort by timestamp (most recent first - highest number first) and return only top 3
  return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
}

function generateRecommendations(idea, scoreData, marketData, chats, tasks) {
  const recommendations = [];
  
  if (!scoreData) {
    recommendations.push({
      priority: 'high',
      title: 'Get Your Idea Scored',
      description: 'See how your idea stacks up across key startup metrics',
      link: '/scoreboard-page.html',
      icon: 'score'
    });
  }
  
  if (!marketData) {
    recommendations.push({
      priority: 'high',
      title: 'Research Your Market',
      description: 'Understand your competitors and market opportunity',
      link: '/market-research.html',
      icon: 'research'
    });
  }
  
  if (chats.length === 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Chat with Your Chat Agent',
      description: 'Brainstorm ideas and get strategic advice',
      link: '/chat-page.html',
      icon: 'chat'
    });
  }
  
  if (scoreData && scoreData.overall_score < 60) {
    recommendations.push({
      priority: 'medium',
      title: 'Improve Your Score',
      description: 'Work on weak areas to strengthen your idea',
      link: '/brainstorm.html',
      icon: 'brainstorm'
    });
  }
  
  // Always suggest action plan if they have enough context
  if (scoreData && marketData) {
    recommendations.push({
      priority: 'low',
      title: 'Create Your Action Plan',
      description: 'Turn insights into concrete next steps',
      link: '/action-page.html',
      icon: 'action'
    });
  }
  
  return recommendations.slice(0, 3);
}

function generateQuickActions(scoreData, marketData, chats) {
  const actions = [
    {
      id: 'chat',
      label: 'Chat',
      icon: 'chat',
      link: '/chat-page.html',
      glow: false
    },
    {
      id: 'scoreboard',
      label: scoreData ? 'Score' : 'Get Scored',
      icon: 'score',
      link: '/scoreboard-page.html',
      glow: !scoreData
    },
    {
      id: 'market',
      label: 'Research',
      icon: 'research',
      link: '/market-research.html',
      glow: !marketData
    },
    {
      id: 'action',
      label: 'Actions',
      icon: 'action',
      link: '/action-page.html',
      glow: false
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: 'tasks',
      link: '/tasks-page.html',
      glow: false
    },
    {
      id: 'brainstorm',
      label: 'Brainstorm',
      icon: 'brainstorm',
      link: '/brainstorm.html',
      glow: false
    },
    {
      id: 'cobuilder',
      label: 'CoBuilder',
      icon: 'code',
      link: '/cobuilder2-page.html',
      glow: false
    },
    {
      id: 'idea',
      label: 'Your Idea',
      icon: 'idea',
      link: '/idea-hub.html',
      glow: false
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: 'star',
      link: '/marketplace.html',
      glow: false
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      link: '/settings-page.html',
      glow: false
    }
  ];
  
  return actions;
}

/**
 * Get all projects/ideas for a user
 */
const getProjects = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const ideas = await Idea.find({ userId })
      .select('ideaName idea createdAt updatedAt')
      .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      projects: ideas.map(idea => ({
        _id: idea._id,
        name: idea.ideaName,
        description: idea.idea?.substring(0, 200) || '',
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
};

module.exports = { getDashboardData, getDashboardAIInsights, getProjects };
