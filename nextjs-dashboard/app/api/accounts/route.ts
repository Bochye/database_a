import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userid = searchParams.get('userid');
    // userid指定があれば特定検索、なければ全件取得
    const accounts = await prisma.accounts.findMany({
      where: userid ? { userid: userid } : {},
      orderBy: { id: 'asc' },
    });
    return NextResponse.json({ accounts }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: '取得に失敗しました。' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userid, password, isadmin, department } = body;
    if (!userid || !password) return NextResponse.json({ error: '入力不足です' }, { status: 400 });

    // ユーザーIDの重複チェック
    const existing = await prisma.accounts.findFirst({ where: { userid } });
    if (existing) {
      return NextResponse.json({ error: 'このユーザーIDは既に使用されています。' }, { status: 409 });
    }

    const created = await prisma.accounts.create({
      data: { userid, password, isadmin: !!isadmin, department: department || 'CS' },
    });
    return NextResponse.json({ account: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: '作成に失敗しました。' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userid, password, isadmin, department } = body;

    if (!id) return NextResponse.json({ error: 'id が必要です。' }, { status: 400 });

    // 現在のユーザー情報を取得して、古い userid を確認する
    const currentUser = await prisma.accounts.findUnique({
      where: { id: Number(id) }
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    const oldUserId = currentUser.userid;

    // ユーザーIDを変更する場合、重複チェック
    if (userid && userid !== oldUserId) {
      const existing = await prisma.accounts.findFirst({ where: { userid } });
      if (existing) {
        return NextResponse.json({ error: 'このユーザーIDは既に使用されています。' }, { status: 409 });
      }
    }

    // トランザクションを使用して、ユーザーと資産を同時に更新
    const result = await prisma.$transaction(async (tx) => {
      // 1. ユーザー情報の更新
      const updatedAccount = await tx.accounts.update({
        where: { id: Number(id) },
        data: {
          ...(userid ? { userid } : {}),
          ...(password ? { password } : {}),
          ...(department ? { department } : {}),
          ...(typeof isadmin === 'boolean' ? { isadmin } : {}),
        },
      });

      // 2. ユーザーIDが変更された場合のみ、資産の manager 欄を一括更新
      if (userid && userid !== oldUserId) {
        await tx.items.updateMany({
          where: { manager: oldUserId },
          data: { manager: userid }
        });
      }

      return updatedAccount;
    });

    return NextResponse.json({ account: result }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    await prisma.accounts.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: '削除完了' }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
  }
}