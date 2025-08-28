const jwt = require('jsonwebtoken')

const authenticateToken = (req, res, next)=>{ 
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user)=>{
    if (err) {
      console.error('JWT verification failed:', err);
      return res.sendStatus(403)
    }
      
    req.user = user
    next()
  })
}

module.exports = authenticateToken;