const axios = require('axios')

exports.isAuthenticated = async (req, res, next) => {
  const token =
    (req.headers.authorization && req.headers.authorization.split(' ')[1]) ||
    (req.cookies && req.cookies.Authorization)

  if (!token) {
    return res.status(400).json({ error: 'token is required' })
  }

  axios
    .get(process.env.AUTH_ENDPOINT + '/check-session?token=' + token)
    .then((response) => {
      if (response.status !== 200) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const userId = parseInt(response.data.value)
      req.userId = userId

      next()
    })
    .catch((error) => {
      console.error('Error checking session:', error)
      res.status(500).json({ error: 'Failed to check session' })
    })
}
