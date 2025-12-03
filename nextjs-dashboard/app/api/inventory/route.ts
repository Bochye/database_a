import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');
    if (!ownerId) return NextResponse.json({ error: 'ownerIdが必要です。' }, { status: 400 });

    const records = await prisma.inventoryRecords.findMany({
      where: { ownerId },
      orderBy: { confirmedAt: 'desc' },
      include: { item: true },
    });

    return NextResponse.json({ records }, { status: 200 });
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
    const { ownerId, itemIds, note } = body;
    if (!ownerId || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'ownerId と itemIds が必要です。' }, { status: 400 });
    }

    const created = await prisma.$transaction(
      itemIds.map((id: number) =>
        prisma.inventoryRecords.create({
          data: {
            ownerId,
            itemId: Number(id),
            note: note || null,
          },
        })
      )
    );

    return NextResponse.json({ records: created }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '登録に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}