import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 管理者が新しい棚卸しラウンドを開始するAPI (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const { title, adminId } = await req.json();

    if (!title || !adminId) {
      return NextResponse.json({ error: 'タイトルと管理者IDは必須です。' }, { status: 400 });
    }

    // トランザクションで一括処理
    const newRound = await prisma.$transaction(async (tx) => {
      // 1. 既存の全てのラウンドを「過去」にする（isCurrent: false）
      await tx.inventoryRounds.updateMany({
        data: { isCurrent: false }
      });

      // 2. 新しい棚卸しラウンドを作成（isCurrent: true）
      return await tx.inventoryRounds.create({
        data: {
          title,
          createdBy: adminId,
          isCurrent: true
        }
      });
    });

    return NextResponse.json({ success: true, round: newRound }, { status: 201 });
  } catch (error) {
    console.error('InventoryRound POST Error:', error);
    return NextResponse.json({ error: '棚卸しのリセットに失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 現在アクティブなラウンド情報を取得するAPI (GET)
 */
export async function GET() {
  try {
    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ currentRound }, { status: 200 });
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