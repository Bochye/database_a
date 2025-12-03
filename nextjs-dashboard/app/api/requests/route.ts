import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, RequestStatus, RequestType } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get('requesterId') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';

    const where: any = {};
    if (requesterId) where.requesterId = requesterId;
    if (status && Object.keys(RequestStatus).includes(status)) where.status = status;
    if (type && Object.keys(RequestType).includes(type)) where.type = type;

    const requests = await prisma.requests.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { item: true },
    });

    return NextResponse.json({ requests }, { status: 200 });
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
    const { itemId, requesterId, type, note } = body;
    if (!itemId || !requesterId || !type) {
      return NextResponse.json({ error: '必須項目（itemId, requesterId, type）が不足しています。' }, { status: 400 });
    }

    const created = await prisma.requests.create({
      data: {
        itemId: Number(itemId),
        requesterId,
        type,
        note,
      },
    });

    return NextResponse.json({ request: created }, { status: 201 });
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
    const { id, status, note } = body;
    if (!id || !status) {
      return NextResponse.json({ error: '必須項目（id, status）が不足しています。' }, { status: 400 });
    }

    const updated = await prisma.requests.update({
      where: { id: Number(id) },
      data: {
        status,
        note,
      },
    });

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}