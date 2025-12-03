import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AssetStatus } from '@prisma/client';

const prisma = new PrismaClient();

// List with optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status') || '';
    const ownerId = searchParams.get('ownerId') || '';
    const onlyMine = searchParams.get('onlyMine') === 'true';

    const where: any = {};

    if (q) {
      where.OR = [
        { assetCode: { contains: q } },
        { name: { contains: q } },
        { location: { contains: q } },
        { manager: { contains: q } },
      ];
    }
    if (status && Object.keys(AssetStatus).includes(status)) {
      where.status = status as AssetStatus;
    }
    if (onlyMine && ownerId) {
      where.ownerid = ownerId;
    }

    const items = await prisma.items.findMany({
      where,
      orderBy: { id: 'desc' },
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ message: 'Failed to fetch items.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

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
        status: status || 'USED',
        stock: stock ?? 1,
        ownerid,
      },
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating item:', error);
    const msg = error?.code === 'P2002' ? '資産コードが重複しています。' : '資産追加に失敗しました。';
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
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
    if (error.code === 'P2025') {
      return NextResponse.json({ error: '指定された資産IDが見つかりませんでした。' }, { status: 404 });
    }
    console.error('Error updating item:', error);
    return NextResponse.json({ error: '資産更新に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Partial updates (status/location/manager/owner transfer)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, location, manager, ownerid } = body;
    if (!id) return NextResponse.json({ error: 'IDが必要です。' }, { status: 400 });

    const data: any = {};
    if (status) data.status = status;
    if (location !== undefined) data.location = location || null;
    if (manager !== undefined) data.manager = manager || null;
    if (ownerid !== undefined) data.ownerid = ownerid;

    const updated = await prisma.items.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (error) {
    console.error('Error patching item:', error);
    return NextResponse.json({ error: '部分更新に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Delete (admin only - check via header or ignore for simplicity)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'IDが必要です。' }, { status: 400 });

    await prisma.items.delete({ where: { id: Number(id) } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: '対象が見つかりません。' }, { status: 404 });
    }
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}