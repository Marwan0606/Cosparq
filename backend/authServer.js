require('dotenv').config()

const express = require('express')
const app = express()

const cors = require('cors');

const jwt = require('jsonwebtoken')

const bcrypt = require('bcrypt');

const database = require('./db/connect.js')


const User   = require('./models/Users.js');

app.use(cors({ origin: 'http://localhost:5004' }));


app.use(express.json())

//NEED MONGODB DATABASE FOR REFRESH TOKENS
let refreshTokens = [] //THIS JUST FOR TESTING

app.post('/token', (req, res)=>{
  const refreshToken = req.body.token
  //console.log(`refreshToken: ${refreshToken}`)
  if (refreshToken === null) return res.sendStatus(401)
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403)
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user)=>{
    if (err) return res.sendStatus(403)
    const accessToken = generateAccessToken({userId: user.userId})
    res.json({accessToken: accessToken})
  })
})


/*
app.delete('/logout', (req, res)=>{
  refreshTokens = refreshTokens.filter(token => token !== req.body.token)
  res.sendStatus(204)
})
*/


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
    res.status(500).send()
  }
})



app.post('/login', async (req, res)=>{
  const {email, password} = req.body
  const user1 = await User.findOne({email: email})

  if (!user1) {
    return res.status(400).send('Cannot find user')
  }

  const match = await bcrypt.compare(password, user1.password);
  if (!match) {
    return res.status(403).json({ msg: 'Not allowed' });
  }


  const user = {userId: user1._id}
  const accessToken = generateAccessToken(user)
  const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET)

  refreshTokens.push(refreshToken);

  res.json({accessToken: accessToken, refreshToken: refreshToken}) 
})




function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '10m'})
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