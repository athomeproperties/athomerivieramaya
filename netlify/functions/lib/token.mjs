import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = () => {
  const s = process.env.APPROVE_SECRET;
  if (!s || s.length < 16) throw new Error('APPROVE_SECRET is not set (16+ characters required)');
  return s;
};

const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function sign(payload, ttlDays = 45) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlDays * 86400000 }));
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
