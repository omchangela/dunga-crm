import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

const isTLS = redisUrl.startsWith('rediss://')

const makeRedis = () => new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck:     false,
    ...(isTLS && {
        tls: { rejectUnauthorized: false }
    })
})

export const redis = makeRedis()

export const redisConnection = {
    connection: makeRedis()
}

redis.on('connect', () => console.log('✓ Redis connected'))
redis.on('error',   (err: Error) => console.error('✗ Redis error:', err.message))