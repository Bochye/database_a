import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AssetStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, userId, newStatus, newLocation } = body;

    // 1. 現在アクティブな棚卸し期間（Round）を取得
    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!currentRound) {
      return NextResponse.json({ error: '現在アクティブな棚卸し期間がありません。' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 2. 回答を記録 (エラー修正箇所: numberを直接入れず、connectを使用する)
      const record = await tx.inventoryRecords.create({
        data: {
          ownerId: userId,
          newLocation: newLocation,
          newStatus: newStatus as AssetStatus,
          // 直接 ID を入れるのではなく、リレーションとして接続する
          item: {
            connect: { id: Number(itemId) }
          },
          round: {
            connect: { id: currentRound.id }
          }
        },
      });

      // 3. 資産マスターを更新
      await tx.items.update({
        where: { id: Number(itemId) },
        data: {
          location: newLocation,
          status: newStatus as AssetStatus,
          updatedBy: userId,
        }
      });

      return record;
    });

    return NextResponse.json({ record: result }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '登録に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}