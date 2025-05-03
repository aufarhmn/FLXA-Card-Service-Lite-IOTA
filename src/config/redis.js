const redis = require('redis')

const REDIS_URL = process.env.UPSTASH_REDIS_URL

const redisClient = redis.createClient({
  url: REDIS_URL
})

;(async () => {
  redisClient.on('error', (err) => {
    console.log('Redis Client Error', err)
  })

  redisClient.on('ready', () => console.log('Redis is Ready!'))

  try {
    await redisClient.connect()
    console.log('Connected to Upstash Redis')
    const pong = await redisClient.ping()
    console.log('PING Response:', pong)
  } catch (err) {
    console.error('Failed to connect to Redis:', err)
  }
})()

module.exports = redisClient
