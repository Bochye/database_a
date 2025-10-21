import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// アイテム全件取得 (GET)
export async function GET() {
  try {
    // 取得時に最新のものが上に来るようにIDで降順ソート
    const items = await prisma.items.findMany({
        orderBy: {
            id: 'desc',
        },
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ message: 'Failed to fetch items.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// アイテム新規追加 (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      assetCode,
      name,
      modelNumber,
      acquisitionDate,
      disposalDate,
      acquisitionCost,
      manager,
      location,
      status,
      stock,
      ownerid,
    } = body;

    // 必須チェックを強化: assetCode, name, ownerid は必須
    if (!assetCode || !name || !ownerid) {
      return NextResponse.json({ error: '必須項目（資産コード、資産名、所有者ID）が不足しています。' }, { status: 400 });
    }

    const newItem = await prisma.items.create({
      data: {
        assetCode,
        name,
        modelNumber,
        acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
        disposalDate: disposalDate ? new Date(disposalDate) : null,
        acquisitionCost: acquisitionCost ? Number(acquisitionCost) : null,
        manager,
        location,
        // status が null/undefined の場合は 'USED' をデフォルト値とする
        status: status || 'USED',
        // stock が null/undefined の場合は 1 をデフォルト値とする
        stock: stock ?? 1, 
        ownerid,
      },
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: '資産追加に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// アイテム更新 (PUT) - IDをボディに含める形式
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, // 更新対象のIDは必須
      assetCode,
      name,
      modelNumber,
      acquisitionDate,
      disposalDate,
      acquisitionCost,
      manager,
      location,
      status,
      stock,
      ownerid,
    } = body;

    if (!id || !assetCode || !name || !ownerid) {
      return NextResponse.json({ error: '更新に必要な項目（ID, 資産コード, 資産名, 所有者ID）が不足しています。' }, { status: 400 });
    }

    const updatedItem = await prisma.items.update({
      where: { id: Number(id) },
      data: {
        assetCode,
        name,
        modelNumber,
        acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
        disposalDate: disposalDate ? new Date(disposalDate) : null,
        acquisitionCost: acquisitionCost ? Number(acquisitionCost) : null,
        manager,
        location,
        status: status || 'USED',
        stock: stock ?? 1,
        ownerid,
      },
    });

    return NextResponse.json({ item: updatedItem }, { status: 200 });
  } catch (error: any) {
    // PrismaのエラーコードP2025はレコードが見つからない場合に発生
    if (error.code === 'P2025') {
        return NextResponse.json({ error: '指定された資産IDが見つかりませんでした。' }, { status: 404 });
    }
    console.error('Error updating item:', error);
    return NextResponse.json({ error: '資産更新に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
