require('dotenv').config({ path: '.env.local' });
const { Redis } = require('@upstash/redis');

async function flushCache() {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    try {
        console.log("Flushing Redis...");
        await redis.flushdb();
        console.log("Redis flushed successfully!");
    } catch (e) {
        console.error("Error flushing Redis:", e);
    }
}

flushCache();
