import { createClient } from 'redis'

// Create Redis client
const client = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with a max delay of 10 seconds
      const delay = Math.min(Math.pow(2, retries) * 100, 10000);
      console.log(`Redis reconnecting... attempt ${retries} in ${delay}ms`);
      return delay;
    }
  }
})

// Handle connection events
client.on('error', (err) => {
  console.error('Redis error:', err);
});

client.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

client.on('connect', () => {
  console.log('Redis connected');
});

// Connect to Redis
client.connect().catch((err) => {
  console.error('Redis initial connection error:', err)
})

/**
 * Ensures Redis client is connected before performing operations
 * @returns A connected Redis client
 */
async function ensureConnection() {
  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (error) {
      console.error('Failed to reconnect to Redis:', error);
    }
  }
  return client;
}

/**
 * Set a value in Redis (server-side only)
 * @param key The key to set
 * @param value The value to set
 * @param expireInSeconds Optional TTL in seconds
 */
export async function setRedisValue(key: string, value: any, expireInSeconds?: number): Promise<boolean> {
  try {
    const connectedClient = await ensureConnection();
    
    if (expireInSeconds) {
      await connectedClient.set(key, JSON.stringify(value), { EX: expireInSeconds })
    } else {
      await connectedClient.set(key, JSON.stringify(value))
    }
    return true
  } catch (error) {
    console.error('Error setting Redis value:', error)
    return false
  }
}

/**
 * Get a value from Redis (server-side only)
 * @param key The key to retrieve
 * @returns The value or null if not found
 */
export async function getRedisValue<T>(key: string): Promise<T | null> {
  try {
    const connectedClient = await ensureConnection();
    const value = await connectedClient.get(key)
    return value ? JSON.parse(value) as T : null
  } catch (error) {
    console.error('Error getting Redis value:', error)
    return null
  }
}

/**
 * Delete a key from Redis (server-side only)
 * @param key The key to delete
 */
export async function deleteRedisValue(key: string): Promise<boolean> {
  try {
    const connectedClient = await ensureConnection();
    await connectedClient.del(key)
    return true
  } catch (error) {
    console.error('Error deleting Redis value:', error)
    return false
  }
}

/**
 * Set a value in Redis with hash (server-side only)
 * @param hashKey The hash key
 * @param field The field in the hash
 * @param value The value to set
 */
export async function setRedisHashValue(hashKey: string, field: string, value: any): Promise<boolean> {
  try {
    const connectedClient = await ensureConnection();
    await connectedClient.hSet(hashKey, field, JSON.stringify(value))
    return true
  } catch (error) {
    console.error('Error setting Redis hash value:', error)
    return false
  }
}

/**
 * Get a value from Redis hash (server-side only)
 * @param hashKey The hash key
 * @param field The field in the hash
 * @returns The value or null if not found
 */
export async function getRedisHashValue<T>(hashKey: string, field: string): Promise<T | null> {
  try {
    const connectedClient = await ensureConnection();
    const value = await connectedClient.hGet(hashKey, field)
    return value ? JSON.parse(value) as T : null
  } catch (error) {
    console.error('Error getting Redis hash value:', error)
    return null
  }
}

/**
 * Get all Redis keys matching a pattern (server-side only)
 * @param pattern The pattern to match (e.g., "user:*:profile")
 * @returns Array of matching keys or empty array if none found
 */
export async function getRedisKeys(pattern: string): Promise<string[]> {
  try {
    const connectedClient = await ensureConnection();
    return await connectedClient.keys(pattern)
  } catch (error) {
    console.error('Error getting Redis keys:', error)
    return []
  }
}
