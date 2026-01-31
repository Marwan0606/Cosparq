/**
 * Email Service for CoSparq
 * Handles all transactional emails: welcome, password reset, subscription notifications, etc.
 * 
 * Uses Nodemailer with SMTP. Supports Gmail, SendGrid, Mailgun, Resend, etc.
 */

const nodemailer = require('nodemailer');

// Create transporter based on environment
const createTransporter = () => {
  // For production, use a proper email service
  // For development, you can use Gmail with an app password or Ethereal (fake SMTP)
  
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // Use App Password, not regular password
      },
    });
  }
  
  if (process.env.EMAIL_SERVICE === 'resend') {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }
  
  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }
  
  // Default: Custom SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// Email templates
const templates = {
  // Welcome email when user signs up
  welcome: (name) => ({
    subject: 'Welcome to CoSparq! 🚀',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
              CoSparq
            </h1>
          </div>
          
          <div style="background: #191a1d; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 24px;">Welcome, ${name}! 👋</h2>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              We're thrilled to have you join CoSparq! You've just unlocked a powerful suite of tools to validate your startup ideas and build faster.
            </p>
            
            <div style="background: #0f0f10; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h3 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 18px;">Here's what you can do:</h3>
              <ul style="color: #a5a7ae; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Score and validate your startup ideas</li>
                <li>Generate detailed market research</li>
                <li>Get AI-powered action plans</li>
                <li>Build MVPs with CoBuilder</li>
              </ul>
            </div>
            
            <a href="${process.env.FRONTEND_URL}/dashboard.html" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">
              Get Started
            </a>
          </div>
          
          <p style="color: #6b6b75; font-size: 12px; text-align: center; margin-top: 32px;">
            © ${new Date().getFullYear()} CoSparq. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to CoSparq, ${name}!\n\nWe're thrilled to have you join CoSparq! You've just unlocked a powerful suite of tools to validate your startup ideas and build faster.\n\nHere's what you can do:\n- Score and validate your startup ideas\n- Generate detailed market research\n- Get AI-powered action plans\n- Build MVPs with CoBuilder\n\nGet started at: ${process.env.FRONTEND_URL}/dashboard.html\n\n© ${new Date().getFullYear()} CoSparq`,
  }),

  // Password reset email
  passwordReset: (name, resetUrl) => ({
    subject: 'Reset Your CoSparq Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
              CoSparq
            </h1>
          </div>
          
          <div style="background: #191a1d; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 24px;">Reset Your Password</h2>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${name}, we received a request to reset your password. Click the button below to create a new password.
            </p>
            
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">
              Reset Password
            </a>
            
            <p style="color: #6b6b75; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
          
          <p style="color: #6b6b75; font-size: 12px; text-align: center; margin-top: 32px;">
            © ${new Date().getFullYear()} CoSparq. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Reset Your CoSparq Password\n\nHi ${name}, we received a request to reset your password.\n\nClick here to reset: ${resetUrl}\n\nThis link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.\n\n© ${new Date().getFullYear()} CoSparq`,
  }),

  // Subscription upgrade confirmation
  subscriptionUpgrade: (name, planName) => ({
    subject: `Welcome to CoSparq ${planName}! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
              CoSparq
            </h1>
          </div>
          
          <div style="background: #191a1d; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 48px;">🎉</span>
            </div>
            
            <h2 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 24px; text-align: center;">
              Welcome to ${planName}!
            </h2>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
              Thanks for upgrading, ${name}! Your ${planName} subscription is now active. You now have access to all ${planName.toLowerCase()} features.
            </p>
            
            <div style="background: #0f0f10; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
              <h3 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 18px;">Your new features include:</h3>
              <ul style="color: #a5a7ae; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${planName === 'Pro' ? `
                  <li>Full CoBuilder access</li>
                  <li>Advanced market research</li>
                  <li>Priority support</li>
                ` : `
                  <li>Everything in Pro</li>
                  <li>Unlimited projects</li>
                  <li>Team collaboration</li>
                  <li>Custom integrations</li>
                `}
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard.html" 
                 style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
          </div>
          
          <p style="color: #6b6b75; font-size: 12px; text-align: center; margin-top: 32px;">
            © ${new Date().getFullYear()} CoSparq. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to CoSparq ${planName}!\n\nThanks for upgrading, ${name}! Your ${planName} subscription is now active.\n\nGo to your dashboard: ${process.env.FRONTEND_URL}/dashboard.html\n\n© ${new Date().getFullYear()} CoSparq`,
  }),

  // Subscription cancellation
  subscriptionCanceled: (name, endDate) => ({
    subject: 'Your CoSparq Subscription Has Been Canceled',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
              CoSparq
            </h1>
          </div>
          
          <div style="background: #191a1d; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 24px;">Subscription Canceled</h2>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${name}, your subscription has been canceled. You'll continue to have access to your current plan until <strong style="color: #e8e8ea;">${endDate}</strong>.
            </p>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              After that date, your account will be downgraded to the Free plan. Your data will be preserved.
            </p>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Changed your mind? You can resubscribe anytime.
            </p>
            
            <a href="${process.env.FRONTEND_URL}/pricing-page.html" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">
              Resubscribe
            </a>
          </div>
          
          <p style="color: #6b6b75; font-size: 12px; text-align: center; margin-top: 32px;">
            © ${new Date().getFullYear()} CoSparq. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Subscription Canceled\n\nHi ${name}, your subscription has been canceled. You'll continue to have access until ${endDate}.\n\nAfter that, your account will be downgraded to Free. Changed your mind? Resubscribe at: ${process.env.FRONTEND_URL}/pricing-page.html\n\n© ${new Date().getFullYear()} CoSparq`,
  }),

  // Weekly summary (for notification preferences)
  weeklySummary: (name, stats) => ({
    subject: 'Your Weekly CoSparq Summary 📊',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
              CoSparq
            </h1>
          </div>
          
          <div style="background: #191a1d; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 24px;">Your Week in Review 📊</h2>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${name}, here's what you accomplished this week:
            </p>
            
            <div style="display: flex; gap: 16px; margin-bottom: 24px;">
              <div style="flex: 1; background: #0f0f10; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 32px; font-weight: 700; color: #e8e8ea;">${stats.ideasScored || 0}</div>
                <div style="font-size: 14px; color: #6b6b75;">Ideas Scored</div>
              </div>
              <div style="flex: 1; background: #0f0f10; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 32px; font-weight: 700; color: #e8e8ea;">${stats.projectsCreated || 0}</div>
                <div style="font-size: 14px; color: #6b6b75;">Projects</div>
              </div>
            </div>
            
            <a href="${process.env.FRONTEND_URL}/dashboard.html" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">
              Continue Building
            </a>
          </div>
          
          <p style="color: #6b6b75; font-size: 12px; text-align: center; margin-top: 32px;">
            You can manage your email preferences in your <a href="${process.env.FRONTEND_URL}/settings-page.html" style="color: #6b6b75;">account settings</a>.
            <br>© ${new Date().getFullYear()} CoSparq. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `Your Week in Review\n\nHi ${name}, here's what you accomplished this week:\n- Ideas Scored: ${stats.ideasScored || 0}\n- Projects Created: ${stats.projectsCreated || 0}\n\nContinue at: ${process.env.FRONTEND_URL}/dashboard.html\n\n© ${new Date().getFullYear()} CoSparq`,
  }),

  // Product update notification
  productUpdate: (name, updateTitle, updateContent) => ({
    subject: `What's New: ${updateTitle} 🚀`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
              CoSparq
            </h1>
          </div>
          
          <div style="background: #191a1d; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #e8e8ea; margin: 0 0 16px 0; font-size: 24px;">${updateTitle} 🚀</h2>
            
            <p style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${name}, we've got some exciting news to share!
            </p>
            
            <div style="color: #a5a7ae; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${updateContent}
            </div>
            
            <a href="${process.env.FRONTEND_URL}/dashboard.html" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">
              Try It Now
            </a>
          </div>
          
          <p style="color: #6b6b75; font-size: 12px; text-align: center; margin-top: 32px;">
            You can manage your email preferences in your <a href="${process.env.FRONTEND_URL}/settings-page.html" style="color: #6b6b75;">account settings</a>.
            <br>© ${new Date().getFullYear()} CoSparq. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `${updateTitle}\n\nHi ${name}, we've got exciting news!\n\n${updateContent}\n\nTry it at: ${process.env.FRONTEND_URL}/dashboard.html\n\n© ${new Date().getFullYear()} CoSparq`,
  }),

  // AI Co-Founder Meeting Summary
  meetingSummary: (name, ideaName, duration, summary) => ({
    subject: `Your AI Co-Founder Meeting Summary 📋`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0; font-size: 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">
              CoSparq
            </h1>
          </div>
          
          <div style="background: #191a1d; border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.08);">
            <h2 style="color: #e8e8ea; margin: 0 0 8px 0; font-size: 24px;">Meeting Summary</h2>
            <p style="color: #6b6b75; font-size: 14px; margin: 0 0 24px 0;">
              ${ideaName ? `Project: ${ideaName}` : ''} ${duration ? `• Duration: ${duration}` : ''}
            </p>
            
            ${summary.ideaStanding ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #8400ff; font-size: 16px; margin: 0 0 12px 0;">How Your Idea Stands Now</h3>
              <p style="color: #a5a7ae; font-size: 15px; line-height: 1.6; margin: 0;">${summary.ideaStanding}</p>
            </div>
            ` : ''}
            
            ${summary.discussed && summary.discussed.length > 0 ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #22c55e; font-size: 16px; margin: 0 0 12px 0;">What We Discussed</h3>
              <ul style="color: #a5a7ae; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${summary.discussed.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${summary.insights && summary.insights.length > 0 ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #f96d16; font-size: 16px; margin: 0 0 12px 0;">Key Insights</h3>
              <ul style="color: #a5a7ae; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${summary.insights.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${summary.whatsNew && summary.whatsNew.length > 0 ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #ba0186; font-size: 16px; margin: 0 0 12px 0;">What's New</h3>
              <ul style="color: #a5a7ae; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${summary.whatsNew.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${summary.nextSteps && summary.nextSteps.length > 0 ? `
            <div style="margin-bottom: 24px;">
              <h3 style="color: #8400ff; font-size: 16px; margin: 0 0 12px 0;">Next Steps</h3>
              <ul style="color: #a5a7ae; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                ${summary.nextSteps.map(step => `<li>${step.text}${step.priority ? ` <span style="color: ${step.priority === 'high' ? '#ef4444' : '#f96d16'}; font-size: 12px; text-transform: uppercase;">[${step.priority}]</span>` : ''}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            <a href="${process.env.FRONTEND_URL}/cofounder-chat.html" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #8400ff 0%, #f94016 40%, #f96d16 60%, #3b82f6 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">
              Start New Meeting
            </a>
          </div>
          
          <p style="color: #6b6b75; font-size: 12px; text-align: center; margin-top: 32px;">
            © ${new Date().getFullYear()} CoSparq. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
    text: `AI Co-Founder Meeting Summary\n\n${ideaName ? `Project: ${ideaName}\n` : ''}${duration ? `Duration: ${duration}\n` : ''}\n${summary.ideaStanding ? `How Your Idea Stands Now:\n${summary.ideaStanding}\n\n` : ''}${summary.discussed?.length ? `What We Discussed:\n${summary.discussed.map(i => `- ${i}`).join('\n')}\n\n` : ''}${summary.insights?.length ? `Key Insights:\n${summary.insights.map(i => `- ${i}`).join('\n')}\n\n` : ''}${summary.nextSteps?.length ? `Next Steps:\n${summary.nextSteps.map(s => `- ${s.text}${s.priority ? ` [${s.priority}]` : ''}`).join('\n')}\n\n` : ''}Start a new meeting: ${process.env.FRONTEND_URL}/cofounder-chat.html\n\n© ${new Date().getFullYear()} CoSparq`,
  }),
};

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} templateName - Name of the template to use
 * @param {object} templateData - Data to pass to the template
 * @returns {Promise<object>} - Result of the email send operation
 */
const sendEmail = async (to, templateName, templateData = {}) => {
  try {
    // Check if email service is configured
    if (!process.env.EMAIL_SERVICE && !process.env.SMTP_HOST) {
      console.log(`[Email Service] Not configured. Would send "${templateName}" to ${to}`);
      return { success: true, mock: true, message: 'Email service not configured' };
    }

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Email template "${templateName}" not found`);
    }

    // Generate email content from template
    let emailContent;
    switch (templateName) {
      case 'welcome':
        emailContent = template(templateData.name);
        break;
      case 'passwordReset':
        emailContent = template(templateData.name, templateData.resetUrl);
        break;
      case 'subscriptionUpgrade':
        emailContent = template(templateData.name, templateData.planName);
        break;
      case 'subscriptionCanceled':
        emailContent = template(templateData.name, templateData.endDate);
        break;
      case 'weeklySummary':
        emailContent = template(templateData.name, templateData.stats);
        break;
      case 'productUpdate':
        emailContent = template(templateData.name, templateData.updateTitle, templateData.updateContent);
        break;
      case 'meetingSummary':
        emailContent = template(templateData.name, templateData.ideaName, templateData.duration, templateData.summary);
        break;
      default:
        throw new Error(`Unknown template: ${templateName}`);
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"CoSparq" <noreply@cosparq.com>',
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    const transporter = getTransporter();
    const result = await transporter.sendMail(mailOptions);
    
    console.log(`[Email Service] Sent "${templateName}" to ${to}. MessageId: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`[Email Service] Failed to send "${templateName}" to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to new user
 */
const sendWelcomeEmail = (email, name) => {
  return sendEmail(email, 'welcome', { name });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = (email, name, resetUrl) => {
  return sendEmail(email, 'passwordReset', { name, resetUrl });
};

/**
 * Send subscription upgrade email
 */
const sendSubscriptionUpgradeEmail = (email, name, planName) => {
  return sendEmail(email, 'subscriptionUpgrade', { name, planName });
};

/**
 * Send subscription canceled email
 */
const sendSubscriptionCanceledEmail = (email, name, endDate) => {
  return sendEmail(email, 'subscriptionCanceled', { name, endDate });
};

/**
 * Send weekly summary email
 */
const sendWeeklySummaryEmail = (email, name, stats) => {
  return sendEmail(email, 'weeklySummary', { name, stats });
};

/**
 * Send product update email
 */
const sendProductUpdateEmail = (email, name, updateTitle, updateContent) => {
  return sendEmail(email, 'productUpdate', { name, updateTitle, updateContent });
};

/**
 * Send AI Co-Founder meeting summary email
 */
const sendMeetingSummaryEmail = (email, name, ideaName, duration, summary) => {
  return sendEmail(email, 'meetingSummary', { name, ideaName, duration, summary });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendSubscriptionUpgradeEmail,
  sendSubscriptionCanceledEmail,
  sendWeeklySummaryEmail,
  sendProductUpdateEmail,
  sendMeetingSummaryEmail,
  templates,
};
