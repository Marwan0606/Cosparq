const express = require('express');
const path = require('path');
const app = express();
require('dotenv').config()
const database = require('./db/connect.js')
const jwt = require('jsonwebtoken')

const responses = require('./routes/gpt-responses.js')
const users = require('./routes/users')
const saveIdea = require('./routes/save-idea.js')
const saveScoreResponse = require('./routes/save-scoreboard-response.js')
const saveMarket = require('./routes/save-market.js')
const saveChat = require('./routes/save-chats.js')
const saveRawChat = require('./routes/save-raw-chats.js')
const saveAction = require('./routes/save-action.js')
const tasks = require('./routes/tasks-page.js')
const saveCode = require('./routes/save-code.js')
const saveCobuilder2 = require('./routes/save-cobuilder2.js')
const saveRenew = require('./routes/save-renew.js')
const payments = require('./routes/payments.js')
const marketplace = require('./routes/marketplace.js')
const brainstorm = require('./routes/brainstorm.js')
const ideaHub = require('./routes/ideaHub.js')
const dashboard = require('./routes/dashboard.js')
const cofounder = require('./routes/cofounder.js')
const actionsRoutes = require('./routes/actions.js')
const prdBuilder = require('./routes/prd-builder.js')
const waitlistRoutes = require('./routes/waitlist.js')

const authenticateToken = require('./middleware/authenticateToken.js')
const { captureRawBody, verifyStripeSignature } = require('./middleware/stripeWebhook.js');
const { handleWebhook, stripe } = require('./controllers/payments.js');

app.use('/', express.static(path.join(__dirname, '../frontend')));

const cors = require('cors')
const cookieParser = require('cookie-parser');

// apiServer.js
app.use(cors({
  origin:      'http://localhost:5004',
  credentials: true                // ← allow sending cookies back to client
}));

// IMPORTANT: Stripe webhook must be registered BEFORE express.json() and authenticateToken
// because it needs raw body for signature verification and doesn't use JWT
app.post(
  '/api/payments/webhook',
  captureRawBody,
  verifyStripeSignature(stripe, process.env.STRIPE_WEBHOOK_SECRET),
  handleWebhook
);

// Increase body size limit for base64 image uploads (50MB to handle up to 5 images at 5MB each with base64 overhead)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// PUBLIC waitlist endpoint — no auth (visitors on generated landing pages submit here)
app.use('/api/waitlist', waitlistRoutes.publicRouter);

app.use('/api', authenticateToken);

app.use('/api/responses', responses);

app.use('/api/users', users);

app.use('/api/save', saveIdea);

app.use('/api/save', saveScoreResponse);

app.use('/api/save', saveMarket);

app.use('/api/save', saveChat);

app.use('/api/save', saveRawChat);

app.use('/api/save', saveAction);

app.use('/api/v1/tasks', tasks);

app.use('/api/save', saveCode);

app.use('/api/save', saveCobuilder2);

// Protected waitlist routes (auth required — CoSparq user views their waitlist)
app.use('/api/waitlist', waitlistRoutes.protectedRouter);

app.use('/api/save', saveRenew);

// Payment routes (includes webhook which handles its own body parsing)
app.use('/api/payments', payments);

// Marketplace routes
app.use('/api/marketplace', marketplace);

// Brainstorm Hub routes
app.use('/api/brainstorm', brainstorm);

// Idea Hub routes
app.use('/api/idea-hub', ideaHub);

// Dashboard routes
app.use('/api/dashboard', dashboard);

// AI Co-Founder routes
app.use('/api/cofounder', cofounder);

// Actions routes (Google OAuth + Email/Calendar/Content)
app.use('/api', actionsRoutes);

// PRD & AI Prompt Builder routes
app.use('/api/prd', prdBuilder);

const port = process.env.PORT || 5004

const start = async ()=>{
  try {
    await database(process.env.MONGO_URI)
    app.listen(port, console.log(`server is listening on port ${port}...`))
  } catch (error) {
    console.log(error)
  }
}

start();
