import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 管理者が新しい棚卸しラウンドを開始するAPI (POST)
 * carryOver: true の場合、前回の未適用データを引き継ぐ
 */
export async function POST(req: NextRequest) {
  try {
    const { title, adminId, carryOver } = await req.json();

    if (!title || !adminId) {
      return NextResponse.json({ error: 'タイトルと管理者IDは必須です。' }, { status: 400 });
    }

    // トランザクションで一括処理
    const result = await prisma.$transaction(async (tx) => {
      // 1. 引き継ぎ元のラウンドを取得
      // まずアクティブなラウンドを探し、なければ直近の終了したラウンドを参照
      let previousRound = await tx.inventoryRounds.findFirst({
        where: { isCurrent: true }
      });

      if (!previousRound) {
        previousRound = await tx.inventoryRounds.findFirst({
          where: { isCurrent: false },
          orderBy: { createdAt: 'desc' }
        });
      }

      // 2. 前回の未適用レコードの処理
      let pendingRecords: any[] = [];
      let deletedCount = 0;
      if (previousRound) {
        if (carryOver) {
          // 引き継ぐ場合：未適用レコードを取得（後でコピー）
          pendingRecords = await tx.inventoryRecords.findMany({
            where: {
              roundId: previousRound.id,
              status: { in: ['PENDING', 'RESUBMIT_REQUESTED'] }
            }
          });
        } else {
          // 引き継がない場合：未適用レコードを削除
          const deleteResult = await tx.inventoryRecords.deleteMany({
            where: {
              roundId: previousRound.id,
              status: { in: ['PENDING', 'RESUBMIT_REQUESTED'] }
            }
          });
          deletedCount = deleteResult.count;
        }
      }

      // 3. 既存の全てのラウンドを「過去」にする（isCurrent: false）
      await tx.inventoryRounds.updateMany({
        data: { isCurrent: false }
      });

      // 4. 新しい棚卸しラウンドを作成（isCurrent: true）
      const newRound = await tx.inventoryRounds.create({
        data: {
          title,
          createdBy: adminId,
          isCurrent: true
        }
      });

      // 5. 引き継ぎが有効な場合、前回の未適用レコードを新しいラウンドにコピー
      let carriedOverCount = 0;
      if (pendingRecords.length > 0) {
        for (const record of pendingRecords) {
          await tx.inventoryRecords.create({
            data: {
              itemId: record.itemId,
              roundId: newRound.id,
              ownerId: record.ownerId,
              newLocation: record.newLocation,
              newStatus: record.newStatus,
              newStock: record.newStock,
              isApproved: false,
              status: 'PENDING', // 引き継ぎ時はPENDINGにリセット
              confirmedAt: record.confirmedAt // 元の報告日時を保持
            }
          });
          carriedOverCount++;
        }
      }

      return { newRound, carriedOverCount, deletedCount };
    });

    let message = '新しい棚卸しを開始しました。';
    if (result.carriedOverCount > 0) {
      message = `前回の未適用データ ${result.carriedOverCount} 件を引き継ぎました。`;
    } else if (result.deletedCount > 0) {
      message = `前回の未適用データ ${result.deletedCount} 件を削除しました。`;
    }

    return NextResponse.json({
      success: true,
      round: result.newRound,
      carriedOverCount: result.carriedOverCount,
      deletedCount: result.deletedCount,
      message
    }, { status: 201 });
  } catch (error) {
    console.error('InventoryRound POST Error:', error);
    return NextResponse.json({ error: '棚卸しのリセットに失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 現在アクティブなラウンド情報を取得するAPI (GET)
 * 未適用データの件数も返す（新規開始時の引き継ぎ確認用）
 */
export async function GET() {
  try {
    // 現在アクティブなラウンド
    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });

    // 未適用データの件数を取得
    // アクティブなラウンドがない場合は、直近の終了したラウンドを参照
    let pendingCount = 0;
    let lastRoundForPending = currentRound;

    if (!currentRound) {
      // 直近の終了したラウンドを取得
      lastRoundForPending = await prisma.inventoryRounds.findFirst({
        where: { isCurrent: false },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (lastRoundForPending) {
      pendingCount = await prisma.inventoryRecords.count({
        where: {
          roundId: lastRoundForPending.id,
          status: { in: ['PENDING', 'RESUBMIT_REQUESTED'] }
        }
      });
    }

    return NextResponse.json({ currentRound, pendingCount }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: '取得に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 棚卸しを終了するAPI (PATCH)
 * 報告データは残したまま、棚卸しを完了状態にする
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { roundId } = body;

    const updated = await prisma.inventoryRounds.updateMany({
      where: roundId ? { id: roundId } : { isCurrent: true },
      data: { isCurrent: false }
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: '終了する棚卸しが見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '棚卸しを終了しました。' }, { status: 200 });
  } catch (error) {
    console.error('InventoryRound PATCH Error:', error);
    return NextResponse.json({ error: '棚卸しの終了に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 棚卸しをキャンセルするAPI (DELETE)
 * 棚卸しと関連する報告データを全て削除する
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get('roundId');

    await prisma.$transaction(async (tx) => {
      const currentRound = roundId
        ? await tx.inventoryRounds.findUnique({ where: { id: parseInt(roundId) } })
        : await tx.inventoryRounds.findFirst({ where: { isCurrent: true } });

      if (!currentRound) {
        throw new Error('キャンセルする棚卸しが見つかりません。');
      }

      // 1. 関連する棚卸し報告データを削除
      await tx.inventoryRecords.deleteMany({
        where: { roundId: currentRound.id }
      });

      // 2. 棚卸しラウンド自体を削除
      await tx.inventoryRounds.delete({
        where: { id: currentRound.id }
      });
    });

    return NextResponse.json({ success: true, message: '棚卸しをキャンセルしました。' }, { status: 200 });
  } catch (error: any) {
    console.error('InventoryRound DELETE Error:', error);
    return NextResponse.json({ error: error.message || '棚卸しのキャンセルに失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}