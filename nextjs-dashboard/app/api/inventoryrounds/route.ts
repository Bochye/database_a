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