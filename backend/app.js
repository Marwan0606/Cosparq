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
const saveRenew = require('./routes/save-renew.js')
const payments = require('./routes/payments.js')

const authenticateToken = require('./middleware/authenticateToken.js')

app.use('/', express.static(path.join(__dirname, '../frontend')));

const cors = require('cors')
const cookieParser = require('cookie-parser');

// apiServer.js
app.use(cors({
  origin:      'http://localhost:5004',
  credentials: true                // ← allow sending cookies back to client
}));
app.use(express.json());
app.use(cookieParser());


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

app.use('/api/save', saveRenew);

// Payment routes (includes webhook which handles its own body parsing)
app.use('/api/payments', payments);

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
