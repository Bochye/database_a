import { prisma } from '../utils/prisma';
import { authorize } from '../utils/auth';
import { json } from '../utils/json';
import { NextRequest } from 'next/server';
import { AssetStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const body = await req.json();
    const { itemId, newStatus, newLocation } = body;
    const userId = actor.userid;

    // 1. 現在アクティブな棚卸し期間（Round）を取得
    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!currentRound) {
      return json({ error: '現在アクティブな棚卸し期間がありません。' }, { status: 400 });
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

    return json({ record: result }, { status: 201 });
  } catch (e) {
    console.error(e);
    return json({ error: '登録に失敗しました。' }, { status: 500 });
  }
}
