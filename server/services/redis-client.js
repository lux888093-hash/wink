const { runtimeConfig } = require('./config');

let client = null;
let connectPromise = null;
let lastError = '';

function isRedisConfigured() {
  return Boolean(runtimeConfig.redisUrl);
}

async function getClient() {
  if (!isRedisConfigured()) {
    throw new Error('REDIS_NOT_CONFIGURED');
  }

  if (client && client.isOpen) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const { createClient } = require('redis');
      const nextClient = createClient({
        url: runtimeConfig.redisUrl
      });

      nextClient.on('error', (error) => {
        lastError = error.message || 'REDIS_ERROR';
      });

      await nextClient.connect();
      client = nextClient;
      lastError = '';
      return client;
    })().catch((error) => {
      lastError = error.message || 'REDIS_CONNECT_FAILED';
      connectPromise = null;
      throw error;
    });
  }

  return connectPromise;
}

async function incrementWindow(key, windowMs) {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = await getClient();
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.pExpire(key, windowMs);
    }

    const ttlMs = await redis.pTTL(key);
    return {
      count,
      resetAt: Date.now() + Math.max(ttlMs, 0)
    };
  } catch (error) {
    lastError = error.message || 'REDIS_RATE_LIMIT_FAILED';
    return null;
  }
}

async function setJson(key, value, ttlSeconds) {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    const redis = await getClient();
    const payload = JSON.stringify(value);

    if (ttlSeconds) {
      await redis.set(key, payload, {
        EX: ttlSeconds
      });
    } else {
      await redis.set(key, payload);
    }

    return true;
  } catch (error) {
    lastError = error.message || 'REDIS_SET_FAILED';
    return false;
  }
}

async function getJson(key) {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = await getClient();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    lastError = error.message || 'REDIS_GET_FAILED';
    return null;
  }
}

function getRedisHealth() {
  return {
    configured: isRedisConfigured(),
    connected: Boolean(client && client.isOpen),
    lastError
  };
}

module.exports = {
  getJson,
  getRedisHealth,
  incrementWindow,
  isRedisConfigured,
  setJson
};
