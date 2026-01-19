import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * ユーザーの存在を確認する
 * @param userid ユーザーID
 * @returns ユーザーが存在する場合はtrue、存在しない場合はfalse
 */
export async function userExists(userid: string): Promise<boolean> {
  if (!userid) return false;
  const user = await prisma.accounts.findFirst({ where: { userid } });
  return !!user;
}

/**
 * ユーザーが存在しない場合のエラーレスポンスを生成
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'SESSION_INVALID',
      message: 'アカウントが存在しません。再度ログインしてください。'
    },
    { status: 401 }
  );
}
