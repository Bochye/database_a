import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AssetStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 【GET】棚卸し報告一覧、ユーザー別進捗統計、および現在のラウンド情報を取得
 */
export async function GET() {
  try {
    // 1. 現在アクティブな棚卸しラウンドを取得
    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });

    // アクティブなラウンドがない場合は早期リターン
    if (!currentRound) {
      return NextResponse.json({ 
        requests: [], 
        userStats: {}, 
        currentRound: null 
      });
    }

    // 2. 除却済み以外の全資産を取得 (進捗の分母用)
    const allActiveItems = await prisma.items.findMany({
      where: { status: { not: 'DISPOSED' } }
    });

    // 3. 今回のラウンドの全回答を取得
    const currentRecords = await prisma.inventoryRecords.findMany({
      where: { roundId: currentRound.id },
      include: { 
        item: true,
        round: true // フロントエンドでタイトルを引くため
      },
      orderBy: { confirmedAt: 'desc' }
    });

    const userStats: Record<string, any> = {};

    // 4. 統計の集計ロジック
    // 全資産から「本来報告すべき件数」をユーザーごとにセット
    allActiveItems.forEach(item => {
      const u = item.manager || '未割り当て';
      if (!userStats[u]) {
        userStats[u] = { total: 0, reported: 0, applied: 0, records: [] };
      }
      userStats[u].total += 1;
    });

    // 報告済みレコードから「実際の報告数」と「適用済み数」をカウント
    currentRecords.forEach(record => {
      const u = record.ownerId;
      if (userStats[u]) {
        userStats[u].reported += 1;
        // isApproved が true のものだけを適用済み(applied)としてカウント
        if ((record as any).isApproved) {
          userStats[u].applied += 1;
        }
        userStats[u].records.push(record);
      }
    });

    // currentRoundを明示的に返すことで、報告0件でもタイトルが表示可能になる
    return NextResponse.json({ 
      requests: currentRecords, 
      userStats,
      currentRound 
    }, { status: 200 });

  } catch (e) {
    console.error('Inventory GET error:', e);
    return NextResponse.json({ error: 'データ取得に失敗しました', userStats: {} }, { status: 500 });
  }
}

/**
 * 【POST】ユーザーからの棚卸し報告（個数 newStock を含む）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, userId, newStatus, newLocation, newStock } = body;

    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!currentRound) {
      return NextResponse.json({ error: '現在アクティブな棚卸し期間がありません。' }, { status: 400 });
    }

    // 報告レコードを作成
    const record = await prisma.inventoryRecords.create({
      data: {
        ownerId: userId,
        newLocation: newLocation,
        newStatus: newStatus as AssetStatus,
        newStock: newStock != null ? Number(newStock) : undefined,
        isApproved: false, // 初期値は未承認
        item: { connect: { id: Number(itemId) } },
        round: { connect: { id: currentRound.id } }
      } as any, 
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (e) {
    console.error('Inventory POST error:', e);
    return NextResponse.json({ error: '報告の登録に失敗しました。' }, { status: 500 });
  }
}

/**
 * 【PATCH】管理者が報告内容を資産台帳（Items）に一括適用する
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId, action } = await req.json();

    if (action === 'APPROVE_ALL') {
      const pendingRecords = await prisma.inventoryRecords.findMany({
        where: { 
          ownerId: userId, 
          isApproved: false,
          round: { isCurrent: true } 
        }
      });

      if (pendingRecords.length === 0) {
        return NextResponse.json({ message: '適用対象の未承認データがありません。' });
      }

      // トランザクションですべての資産台帳(Items)を更新
      await prisma.$transaction(async (tx) => {
        for (const record of pendingRecords) {
          await tx.items.update({
            where: { id: (record as any).itemId },
            data: {
              location: record.newLocation,
              status: record.newStatus as AssetStatus,
              stock: (record as any).newStock ?? undefined,
              updatedBy: 'SYSTEM_ADMIN'
            }
          });
        }

        // 報告レコードを「承認済み」に変更
        await tx.inventoryRecords.updateMany({
          where: { 
            ownerId: userId, 
            round: { isCurrent: true },
            isApproved: false 
          },
          data: { isApproved: true } as any
        });
      });

      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: '無効なアクションです。' }, { status: 400 });
  } catch (e) {
    console.error('Inventory PATCH error:', e);
    return NextResponse.json({ error: '資産台帳への適用に失敗しました。' }, { status: 500 });
  }
}