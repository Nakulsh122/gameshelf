import { Redis } from '@upstash/redis'

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

// Note: Ensure redis URL and token exist before trying to create the client to prevent unhandled errors during build
export const redis = (redisUrl && redisToken) 
    ? new Redis({
        url: redisUrl,
        token: redisToken,
    }) 
    : null;
