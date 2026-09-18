import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'asset_session';
const SESSION_SECONDS = 8 * 60 * 60;
export const accountSelect = { id: true, userid: true, isadmin: true, department: true } as const;
type SessionAccount = { id: number; userid: string; password: string; isadmin: boolean };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes');
  return value;
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith('scrypt$')) return equal(password, stored);
  const parts = stored.split('$');
  if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  return equal((await derive(password, parts[1])).toString('hex'), parts[2]);
}

function credentialTag(account: SessionAccount) {
  // パスワードやユーザーIDの変更後は、古いセッションを無効にする。
  return sign(JSON.stringify([account.id, account.userid, account.password]));
}

export function setSession(response: NextResponse, account: SessionAccount) {
  const payload = Buffer.from(JSON.stringify({
    id: account.id, expires: Date.now() + SESSION_SECONDS * 1000, credential: credentialTag(account),
    nonce: randomBytes(16).toString('hex'),
  })).toString('base64url');
  response.cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/', maxAge: SESSION_SECONDS,
  });
}

export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0,
  });
}

export function validOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return req.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || origin === new URL(req.url).origin);
}

export function forbidden() {
  return NextResponse.json({ error: 'この操作を行う権限がありません。' }, { status: 403 });
}

export async function authorize(req: NextRequest, adminOnly = false) {
  const unauthorized = () => NextResponse.json({ error: 'SESSION_INVALID', message: '再度ログインしてください。' }, { status: 401 });
  if (!['GET', 'HEAD'].includes(req.method) && !validOrigin(req)) return { response: forbidden() };
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return { response: unauthorized() };
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || !equal(sign(payload), signature)) return { response: unauthorized() };
  let session: { id: number; expires: number; credential: string };
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!session || !Number.isSafeInteger(session.id) || !Number.isFinite(session.expires) || session.expires <= Date.now() || typeof session.credential !== 'string') {
      return { response: unauthorized() };
    }
  } catch {
    return { response: unauthorized() };
  }
  const account = await prisma.accounts.findUnique({ where: { id: session.id } });
  if (!account || !equal(credentialTag(account), session.credential)) return { response: unauthorized() };
  if (adminOnly && !account.isadmin) return { response: forbidden() };
  return { account };
}

export function ownsItem(account: { userid: string }, item: { manager: string | null; ownerid: string }) {
  return item.manager === account.userid || item.ownerid === account.userid;
}
