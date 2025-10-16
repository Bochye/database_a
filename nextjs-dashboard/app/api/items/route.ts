// app/api/items/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GETリクエストに対するハンドラー
export async function GET() {
  try {
    // データベースからすべてのItemsのすべてのフィールドを取得
    const items = await prisma.items.findMany({
      // selectを指定しないことで、すべてのフィールドを取得する
      // { id, name, stock, ownerid, createdAt }
    });

    // 成功した場合はJSON形式でアイテムリストを返す
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error fetching items:', error);
    // エラーが発生した場合は500 Internal Server Errorを返す
    return NextResponse.json({ message: 'Failed to fetch items.' }, { status: 500 });
  } finally {
    // 処理後、Prismaクライアントを切断
    await prisma.$disconnect();
  }
}