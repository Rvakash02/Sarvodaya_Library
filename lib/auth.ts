import crypto from 'node:crypto';

const TOKEN_SECRET = process.env.AUTH_SECRET || 'local-dev-secret-change-before-production-competitive-exam-library';
const PASSWORD_ITERATIONS = 160000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = 'sha512';

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(input: string) {
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(input).digest();
  return base64url(hmac);
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;

function fromBase64url(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function createToken(user: any) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      name: user.name,
      studentId: user.studentId || null,
      iat: Date.now(),
      exp: Date.now() + TOKEN_TTL_MS
    })
  );
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string) {
  const [header, payload, signature] = String(token || '').split('.');
  if (!header || !payload || !signature) return null;
  const expected = sign(`${header}.${payload}`);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  const decoded = JSON.parse(fromBase64url(payload));
  if (!decoded.exp || decoded.exp < Date.now()) return null;
  return decoded;
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST)
    .toString('hex');
  return { salt, passwordHash: hash };
}

export function comparePassword(password: string, user: any) {
  if (!user?.salt || !user?.passwordHash) return false;
  const attempt = hashPassword(password, user.salt).passwordHash;
  return crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(user.passwordHash));
}
