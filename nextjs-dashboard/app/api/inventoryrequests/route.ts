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

    // 既存のレコードを確認（再申請依頼中の場合は更新）
    const existingRecord = await prisma.inventoryRecords.findUnique({
      where: {
        itemId_roundId: {
          itemId: Number(itemId),
          roundId: currentRound.id
        }
      }
    });

    let record;
    if (existingRecord && (existingRecord as any).status === 'RESUBMIT_REQUESTED') {
      // 再申請依頼中のレコードを更新
      record = await prisma.inventoryRecords.update({
        where: { id: existingRecord.id },
        data: {
          ownerId: userId,
          newLocation: newLocation,
          newStatus: newStatus as AssetStatus,
          newStock: newStock != null ? Number(newStock) : undefined,
          status: 'PENDING',
          isApproved: false,
          confirmedAt: new Date()
        } as any
      });
    } else if (!existingRecord) {
      // 新規レコードを作成
      record = await prisma.inventoryRecords.create({
        data: {
          ownerId: userId,
          newLocation: newLocation,
          newStatus: newStatus as AssetStatus,
          newStock: newStock != null ? Number(newStock) : undefined,
          isApproved: false,
          status: 'PENDING',
          item: { connect: { id: Number(itemId) } },
          round: { connect: { id: currentRound.id } }
        } as any,
      });
    } else {
      return NextResponse.json({ error: '既に報告済みです。' }, { status: 400 });
    }

    return NextResponse.json({ record }, { status: 201 });
  } catch (e) {
    console.error('Inventory POST error:', e);
    return NextResponse.json({ error: '報告の登録に失敗しました。' }, { status: 500 });
  }
}

/**
 * 【PATCH】管理者が報告内容を資産台帳（Items）に適用する / 再申請を依頼する
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId, recordId, action } = await req.json();

    // 個別適用
    if (action === 'APPROVE_SINGLE' && recordId) {
      const record = await prisma.inventoryRecords.findUnique({
        where: { id: Number(recordId) }
      });

      if (!record) {
        return NextResponse.json({ error: 'レコードが見つかりません。' }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.items.update({
          where: { id: (record as any).itemId },
          data: {
            location: record.newLocation,
            status: record.newStatus as AssetStatus,
            stock: (record as any).newStock ?? undefined,
            updatedBy: 'SYSTEM_ADMIN'
          }
        });

        await tx.inventoryRecords.update({
          where: { id: Number(recordId) },
          data: {
            isApproved: true,
            status: 'APPROVED'
          } as any
        });
      });

      return NextResponse.json({ success: true });
    }

    // 再申請依頼
    if (action === 'REQUEST_RESUBMIT' && recordId) {
      const record = await prisma.inventoryRecords.findUnique({
        where: { id: Number(recordId) }
      });

      if (!record) {
        return NextResponse.json({ error: 'レコードが見つかりません。' }, { status: 404 });
      }

      await prisma.inventoryRecords.update({
        where: { id: Number(recordId) },
        data: {
          status: 'RESUBMIT_REQUESTED',
          isApproved: false
        } as any
      });

      return NextResponse.json({ success: true });
    }

    // 一括適用
    if (action === 'APPROVE_ALL') {
      const pendingRecords = await prisma.inventoryRecords.findMany({
        where: {
          ownerId: userId,
          status: 'PENDING',
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
            status: 'PENDING'
          },
          data: {
            isApproved: true,
            status: 'APPROVED'
          } as any
        });
      });

      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: '無効なアクションです。' }, { status: 400 });
  } catch (e) {
    console.error('Inventory PATCH error:', e);
    return NextResponse.json({ error: '処理に失敗しました。' }, { status: 500 });
  }
}