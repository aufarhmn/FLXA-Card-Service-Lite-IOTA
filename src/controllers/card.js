const axios = require('axios')
const bcrypt = require('bcrypt')
const db = require('../config/db')
const redisClient = require('../config/redis')

exports.viewCard = (req, res) => {
  const userId = req.userId

  const query = `
      SELECT * FROM "Card" WHERE user_id = $1`
  const values = [userId]

  const operatorMapping = {
    '58fbf693-3363-4066-9ac3-489288d950c9': 'Telkomsel',
    '0dbfa48b-4d97-4ce3-acbc-84910b911e1e': 'XL Axiata',
    'c9b0f2b1-f9e4-4105-9e61-614024fbcdb3': 'Indosat'
  }

  db.query(query, values)
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(200).json([])
      }

      const processedRows = result.rows.map((row) => {
        if (operatorMapping[row.operator_id]) {
          return { ...row, operator_name: operatorMapping[row.operator_id] }
        }
        return row
      })

      res.status(200).json(processedRows)
    })
    .catch((error) => {
      res.status(500).json({ error: error.message })
    })
}

exports.addCard = (req, res) => {
  const userId = req.userId
  const { phoneNumber, operatorId } = req.body

  if (!userId || !phoneNumber || !operatorId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const query = `
          INSERT INTO "Card" (user_id, card_phone_number, card_status, operator_id)
          VALUES ($1, $2, $3, $4)
          RETURNING *`
  const values = [userId, phoneNumber, 'NOT VERIFIED', operatorId]

  db.query(query, values)
    .then((result) => {
      const otp = Math.floor(100000 + Math.random() * 900000)
      const ttl = 300
      const redisKey = `card-otp:${phoneNumber}`

      redisClient
        .set(redisKey, otp, 'EX', ttl)
        .then(() => {
          axios
            .get(
              `${process.env.SEND_MESSAGE_ENDPOINT}/send-otp?number=${phoneNumber}&otp=${otp}`
            )
            .then(() => {
              res.status(201).json(result.rows[0])
            })
            .catch((error) => {
              console.error('Error sending OTP:', error.message)
              res.status(500).json({ error: error.message })
            })
        })
        .catch((error) => {
          console.error('Error setting OTP in Redis:', error.message)
          res.status(500).json({ error: error.message })
        })
    })
    .catch((error) => {
      console.error('Error inserting card into database:', error.message)
      res.status(500).json({ error: error.message })
    })
}

exports.verifyCard = (req, res) => {
  const { phoneNumber, otp } = req.body

  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const redisKey = `card-otp:${phoneNumber}`

  redisClient
    .get(redisKey)
    .then((result) => {
      if (result === otp) {
        const query = `
              UPDATE "Card" SET card_status = $1 WHERE card_phone_number = $2
              RETURNING *`
        const values = ['VERIFIED', phoneNumber]

        db.query(query, values)
          .then((result) => {
            res.status(200).json(result.rows[0])
          })
          .catch((error) => {
            console.error('Error updating card status:', error.message)
            res.status(500).json({ error: error.message })
          })
      } else {
        res.status(400).json({ error: 'Invalid OTP' })
      }
    })
    .catch((error) => {
      console.error('Error getting OTP from Redis:', error.message)
      res.status(500).json({ error: error.message })
    })
}

exports.deleteCard = (req, res) => {
  const { phoneNumber } = req.body

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const query = `
              DELETE FROM "Card" WHERE card_phone_number = $1
              RETURNING *`
  const values = [phoneNumber]

  db.query(query, values)
    .then((result) => {
      console.log('Query result:', result.rows)
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: 'No card found with this phone number' })
      }
      res
        .status(200)
        .json({ message: 'Card deleted successfully', card: result.rows[0] })
    })
    .catch((error) => {
      console.error('Error deleting card:', error.message)
      res.status(500).json({ error: error.message })
    })
}

exports.addCardViaGSM = (req, res) => {
  const { phoneNumber, operatorId, secretString } = req.body

  if (!phoneNumber || !operatorId || !secretString) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const query = `
    SELECT * FROM "User"
  `

  db.query(query)
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No users found' })
      }

      const matchingUser = result.rows.find((user) =>
        bcrypt.compareSync(secretString, user.secret_string)
      )

      if (!matchingUser) {
        return res.status(401).json({ error: 'Invalid secret string' })
      }

      const userId = matchingUser.user_id

      const insertQuery = `
        INSERT INTO "Card" (user_id, card_phone_number, card_status, operator_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `
      const insertValues = [userId, phoneNumber, 'VERIFIED', operatorId]

      db.query(insertQuery, insertValues)
        .then((result) => {
          res.status(201).json(result.rows[0])
        })
        .catch((error) => {
          console.error('Error inserting card into database:', error.message)
          res.status(500).json({ error: error.message })
        })
    })
    .catch((error) => {
      console.error('Error querying users:', error.message)
      res.status(500).json({ error: error.message })
    })
}

const generateAlphanumericString = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

exports.activateBalanceGSM = (req, res) => {
  const { phoneNumber, operatorId, name } = req.body

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const plainSecretString = generateAlphanumericString(8)
  const secretString = bcrypt.hashSync(plainSecretString, 12)

  const query = `
    INSERT INTO "User" (name, secret_string) VALUES ($1, $2) RETURNING *
  `
  const values = [name, secretString]

  db.query(query, values)
    .then((result) => {
      const userId = result.rows[0].user_id

      const insertQuery = `
        INSERT INTO "Card" (user_id, card_phone_number, card_status, operator_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `
      const insertValues = [userId, phoneNumber, 'VERIFIED', operatorId]

      db.query(insertQuery, insertValues)
        .then(() => {
          const insertBalanceQuery = `
            INSERT INTO "Balance" (user_id, balance_amount)
            VALUES ($1, $2)
            RETURNING *
          `
          const insertBalanceValues = [userId, 0]

          db.query(insertBalanceQuery, insertBalanceValues)
            .then((result) => {
              axios
                .get(`${process.env.SEND_MESSAGE_ENDPOINT}/send-message?number=${phoneNumber}&message=${plainSecretString}`)
                .then(() => {
                  res.status(201).json(result.rows[0])
                })
                .catch((error) => {
                  console.error('Error sending secret string:', error.message)
                  res.status(500).json({ error: error.message })
                })
            })
            .catch((error) => {
              console.error('Error inserting balance:', error.message)
              res.status(500).json({ error: error.message })
            })
        })
        .catch((error) => {
          console.error('Error inserting card:', error.message)
          res.status(500).json({ error: error.message })
        })
    })
    .catch((error) => {
      console.error('Error inserting user:', error.message)
      res.status(500).json({ error: error.message })
    })
}
