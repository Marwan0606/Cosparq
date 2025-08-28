require('dotenv').config()

const express = require('express')
const app = express()

const jwt = require('jsonwebtoken')

const bcrypt = require('bcrypt');

const database = require('./db/connect.js')


const User   = require('./models/Users.js');

const RefreshTokenModel = require('./models/Refresh-Tokens.js')

app.use(express.json())

const cors = require('cors')
const cookieParser = require('cookie-parser');

app
.use(cors({
  origin: 'http://localhost:5004',
  credentials: true
  }))
.use(cookieParser());



app.post('/token', async (req, res)=>{
  const refreshToken = req.cookies.jid;
  if (refreshToken === null) return res.sendStatus(401)

  const exists = await findRefreshToken(refreshToken)
  if (!exists) return res.status(403).json('Please Log In Again');

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user)=>{
    if (err) return res.sendStatus(403)
    const accessToken = generateAccessToken({userId: user.userId})
    // Reset the HTTP-only “token” cookie
    res
      .cookie('token', accessToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   15 * 60 * 1000
      })
      .json({ ok: true });
  });
});

async function findRefreshToken(refreshToken) {
  const doc = await RefreshTokenModel.findOne({refreshToken})
  return !!doc
}


app.delete('/logout', async (req, res)=>{
  const refreshToken = req.cookies.jid;
  if (refreshToken) {
    await RefreshTokenModel.findOneAndDelete({ refreshToken });
  }
  res
    .clearCookie('jid',   { path: '/token' })
    .clearCookie('token')
    .sendStatus(204);
})



app.post('/register', async (req, res) => {
  try {
    const email = req.body.email
    const name = req.body.name
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    //console.log(salt)
    //console.log(hashedPassword)
    const user = await User.create({email, name, password: hashedPassword});
    res.status(201).json(user)
  } catch (error) {
    console.log(error)
    res.status(500).json('Email already linked to an existing account')
  }
})



app.post('/login', async (req, res)=>{
  try {
    const {email, password} = req.body
    const user1 = await User.findOne({email: email})

    if (!user1) {
      return res.status(400).json({msg: 'Cannot find user'})
    }

    const match = await bcrypt.compare(password, user1.password);
    if (!match) {
      return res.status(403).json({ msg: 'Incorrect Password' });
    }


    const user = {userId: user1._id}
    const accessToken = generateAccessToken(user)
    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET)

    const deleteOldToken = await RefreshTokenModel.findOneAndDelete({userId: user1._id})
    await RefreshTokenModel.create({refreshToken, userId: user1._id})

    res
      .cookie('token', accessToken, {           
        httpOnly: true,
        sameSite: 'lax',
        secure:   false,           // set to true in prod + HTTPS 
        maxAge:   15*60*1000
      })
      .cookie('jid', refreshToken, {          
        httpOnly: true,
        sameSite: 'lax',
        secure:   false,
        maxAge:   7*24*60*60*1000
      })
      .json({ ok: true });

  } catch (error) {
    console.log(error)
  }
})




function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '15m'})
}

const port = process.env.PORT || 4004

const start = async ()=>{
  try {
    await database(process.env.MONGO_URI)
    app.listen(port, console.log(`server is listening on port ${port}...`))
  } catch (error) {
    console.log(error)
  }
}

start();



//TO CREATE SECRET ACCESS TOKEN JUST OPEN A NEW TERMINAL AND TYPE NODE AND ENTER THEN TYPE: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"