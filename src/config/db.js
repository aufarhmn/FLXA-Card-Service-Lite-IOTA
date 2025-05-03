const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB
})

const checkConnection = async () => {
  try {
    await pool.query('SELECT 1')
    console.log('Database connection established successfully.')
  } catch (error) {
    console.error('Database connection failed:', error.message)
    process.exit(1)
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  checkConnection
}
