const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const app = express()

// DOTENV
const dotenv = require('dotenv')
dotenv.config()

// DATABASE
const db = require('./src/config/db.js')
;(async () => {
  await db.checkConnection()
})()

// MIDDLEWARE
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(morgan('dev'))

// CORS
app.use(cors())

// ROUTES
app.get('/', (req, res) => {
  res.send('FLXA Card Service Lite')
})
app.use('/card', require('./src/routes/card'))

// ROUTE ERROR HANDLING
app.use((req, res, next) => {
  const error = new Error('Not found!')
  error.status = 404
  next(error)
})
app.use((error, req, res, next) => {
  res.status(error.status || 500)
  res.json({
    error: {
      message: error.message
    }
  })
})

// SERVER
app.listen(5002, () => {
  console.log('Server is running!')
})

module.exports = app
