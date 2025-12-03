import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const accounts = await prisma.accounts.findMany({
      orderBy: { id: 'asc' },
    });
    return NextResponse.json({ accounts }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '取得に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userid, password, isadmin } = body;
    if (!userid || !password) {
      return NextResponse.json({ error: 'userid と password が必要です。' }, { status: 400 });
    }
    const created = await prisma.accounts.create({
      data: { userid, password, isadmin: !!isadmin },
    });
    return NextResponse.json({ account: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '作成に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, password, isadmin } = body;
    if (!id) return NextResponse.json({ error: 'id が必要です。' }, { status: 400 });

    const updated = await prisma.accounts.update({
      where: { id: Number(id) },
      data: {
        ...(password ? { password } : {}),
        ...(typeof isadmin === 'boolean' ? { isadmin } : {}),
      },
    });

    return NextResponse.json({ account: updated }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}