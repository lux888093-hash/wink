const crypto = require('crypto');
const { runtimeConfig } = require('./config');

function legacySha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

function verifyPasswordHash(storedHash, password) {
  const normalized = String(storedHash || '');

  if (normalized.startsWith('scrypt$')) {
    const [, salt, digest] = normalized.split('$');

    if (!salt || !digest) {
      return {
        valid: false,
        needsRehash: false
      };
    }

    const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const expectedBuffer = Buffer.from(digest, 'hex');
    const candidateBuffer = Buffer.from(candidate, 'hex');

    if (expectedBuffer.length !== candidateBuffer.length || expectedBuffer.length === 0) {
      return {
        valid: false,
        needsRehash: false
      };
    }

    return {
      valid: crypto.timingSafeEqual(expectedBuffer, candidateBuffer),
      needsRehash: false
    };
  }

  const legacy = legacySha256(password);
  return {
    valid: normalized === legacy,
    needsRehash: normalized === legacy
  };
}

function hashSessionToken(token) {
  return crypto
    .createHmac('sha256', runtimeConfig.adminSessionPepper)
    .update(String(token || ''))
    .digest('hex');
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function createRequestId() {
  return crypto.randomUUID();
}

function isStrongPassword(password) {
  const value = String(password || '');

  if (value.length < 10 || value.length > 128) {
    return false;
  }

  const checks = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  return checks.every((pattern) => pattern.test(value));
}

module.exports = {
  createRequestId,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isStrongPassword,
  legacySha256,
  verifyPasswordHash
};
