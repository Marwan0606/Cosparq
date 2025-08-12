express = require('express');
const path = require('path');
const app = express();
require('dotenv').config()
const database = require('./db/connect.js')

const responses = require('./routes/gpt-responses.js')
const users = require('./routes/users')
const saveIdea = require('./routes/save-idea.js')
const saveScoreResponse = require('./routes/save-scoreboard-response.js')
const saveMarket = require('./routes/save-market.js')
const saveChat = require('./routes/save-chats.js')

app.use('/', express.static(path.join(__dirname, '../frontend')));

app.use(express.json());

app.use('/api/responses', responses);

app.use('/api/users', users);

app.use('/api/save', saveIdea);

app.use('/api/save', saveScoreResponse);

app.use('/api/save', saveMarket);

app.use('/api/save', saveChat);

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
