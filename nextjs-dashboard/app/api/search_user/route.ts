import { NextRequest } from 'next/server';
import { prisma } from '../utils/prisma';
import { authorize, clearSession, forbidden, setSession, validOrigin, verifyPassword } from '../utils/auth';
import { json } from '../utils/json';

// 認証情報はURLに載せず、POST本文で受け取る。
export async function POST(req: NextRequest) {
  try {
    if (!validOrigin(req)) return forbidden();
    const { user, pass } = await req.json();
    if (typeof user !== 'string' || typeof pass !== 'string' || !user || !pass || pass.length > 1024) {
      return json({ success: false }, { status: 400 });
    }
    const account = await prisma.accounts.findUnique({ where: { userid: user } });
    if (!account || !await verifyPassword(pass, account.password)) {
      const response = json({ success: false }, { status: 401 });
      clearSession(response);
      return response;
    }
    const response = json({ success: true, userid: account.userid, isAdmin: account.isadmin });
    setSession(response, account);
    return response;
  } catch {
    return json({ success: false, error: 'ログイン処理に失敗しました。' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req);
    if (auth.response) return auth.response;
    return json({ success: true, userid: auth.account.userid, isAdmin: auth.account.isadmin });
  } catch {
    return json({ error: 'ログイン状態を取得できません。' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!validOrigin(req)) return forbidden();
  const response = json({ success: true });
  clearSession(response);
  return response;
}
