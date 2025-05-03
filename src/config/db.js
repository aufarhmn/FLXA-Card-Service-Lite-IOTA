const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.POSTGRE_CONN_STRING,
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
