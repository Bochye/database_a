import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AssetStatus, Department } from '@prisma/client';

const prisma = new PrismaClient();

// BigInt を Number に変換するヘルパー（JSON シリアライズ対応）
function serializeItem(item: any) {
  if (!item) return item;
  return {
    ...item,
    acquisitionCost: item.acquisitionCost != null ? Number(item.acquisitionCost) : null,
  };
}

function serializeItems(items: any[]) {
  return items.map(serializeItem);
}

// --- 一覧取得 (GET) ---
// 権限(isAdmin)とユーザー名(managerParam)に基づいて閲覧範囲を強制制限
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // クエリパラメータの取得
    const assetCode = searchParams.get('assetCode');
    const name = searchParams.get('name');
    const modelNumber = searchParams.get('modelNumber');
    const location = searchParams.get('location');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const managerFilter = searchParams.get('manager'); // 検索フィルター用の管理者名

    // 閲覧制限のためのパラメータ
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const onlyMine = searchParams.get('onlyMine') === 'true';
    // ログイン中のユーザー名を特定するためのパラメータ
    const currentUserName = searchParams.get('currentUser') || searchParams.get('ownerId') || searchParams.get('ownerid');

    const where: any = {};

    // 1. 基本検索フィルタ (部分一致)
    if (assetCode) where.assetCode = { contains: assetCode };
    if (name) where.name = { contains: name };
    if (modelNumber) where.modelNumber = { contains: modelNumber };
    if (location) where.location = { contains: location };
    if (status) where.status = status;
    if (department) where.department = department;

    // 2. セキュリティ/閲覧制限ロジック
    if (!isAdmin) {
      // 一般ユーザーの場合：自分が manager または ownerid である資産に制限
      if (!currentUserName) {
        return NextResponse.json({ items: [] }, { status: 200 });
      }
      where.OR = [
        { manager: currentUserName },
        { ownerid: currentUserName }
      ];
    } else {
      // 管理者の場合
      if (onlyMine && currentUserName) {
        // onlyMineチェック時：自分の資産のみ
        where.manager = currentUserName;
      } else if (managerFilter) {
        // 管理者名での検索フィルター（部分一致）
        where.manager = { contains: managerFilter };
      }
      // それ以外(onlyMine=false かつ フィルターなし)の場合は全件対象
    }

// GET メソッド内
const items = await prisma.items.findMany({
  where,
  include: {
    InventoryRecords: {
      where: {
        round: { isCurrent: true }
      },
      select: {
        id: true,
        isApproved: true,
        status: true // ステータス（PENDING, APPROVED, RESUBMIT_REQUESTED）
      }
    }
  },
  orderBy: { id: 'desc' },
});
    
    return NextResponse.json({ items: serializeItems(items) }, { status: 200 });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: '資産データの取得に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// 日付バリデーション用ヘルパー関数
function parseAndValidateDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null; // Invalid Date
  return date;
}

// --- 新規登録 (POST) ---
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      assetCode, name, modelNumber, acquisitionDate, disposalDate,
      acquisitionCost, manager, location, status, stock, ownerid, department, updatedBy
    } = body;

    if (!assetCode || !name || !ownerid) {
      return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 });
    }

    // 日付のバリデーション
    const acqDate = parseAndValidateDate(acquisitionDate);
    const dispDate = parseAndValidateDate(disposalDate);

    if (acquisitionDate && !acqDate) {
      return NextResponse.json({ error: '取得日の形式が無効です。' }, { status: 400 });
    }
    if (disposalDate && !dispDate) {
      return NextResponse.json({ error: '廃棄日の形式が無効です。' }, { status: 400 });
    }
    if (acqDate && dispDate && dispDate < acqDate) {
      return NextResponse.json({ error: '廃棄日は取得日より後の日付にしてください。' }, { status: 400 });
    }

    const newItem = await prisma.items.create({
      data: {
        assetCode,
        name,
        modelNumber: modelNumber || null,
        acquisitionDate: acqDate,
        disposalDate: dispDate,
        acquisitionCost: acquisitionCost ? BigInt(Math.floor(Number(acquisitionCost))) : null,
        manager: manager || null,
        location: location || null,
        status: (status as AssetStatus) || AssetStatus.USED,
        stock: stock != null ? Number(stock) : 0,
        ownerid: ownerid,
        department: (department as Department) || Department.CS,
        updatedBy: updatedBy || ownerid,
      },
    });

    return NextResponse.json({ item: serializeItem(newItem) }, { status: 201 });
  } catch (error: any) {
    const msg = error?.code === 'P2002' ? '資産コードが重複しています。' : '資産の追加に失敗しました。';
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// --- 全更新 (PUT) ---
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, assetCode, name, modelNumber, acquisitionDate, disposalDate,
      acquisitionCost, manager, location, status, stock, ownerid, department, updatedBy
    } = body;

    if (!id || !assetCode || !name || !ownerid) {
      return NextResponse.json({ error: '更新に必要な項目が不足しています。' }, { status: 400 });
    }

    // 日付のバリデーション
    const acqDate = parseAndValidateDate(acquisitionDate);
    const dispDate = parseAndValidateDate(disposalDate);

    if (acquisitionDate && !acqDate) {
      return NextResponse.json({ error: '取得日の形式が無効です。' }, { status: 400 });
    }
    if (disposalDate && !dispDate) {
      return NextResponse.json({ error: '廃棄日の形式が無効です。' }, { status: 400 });
    }
    if (acqDate && dispDate && dispDate < acqDate) {
      return NextResponse.json({ error: '廃棄日は取得日より後の日付にしてください。' }, { status: 400 });
    }

    const updatedItem = await prisma.items.update({
      where: { id: Number(id) },
      data: {
        assetCode,
        name,
        modelNumber: modelNumber || null,
        acquisitionDate: acqDate,
        disposalDate: dispDate,
        acquisitionCost: acquisitionCost ? BigInt(Math.floor(Number(acquisitionCost))) : null,
        manager: manager || null,
        location: location || null,
        status: (status as AssetStatus) || AssetStatus.USED,
        stock: stock != null ? Number(stock) : 0,
        ownerid: ownerid,
        department: (department as Department) || Department.CS,
        updatedBy: updatedBy || null,
      },
    });

    return NextResponse.json({ item: serializeItem(updatedItem) }, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ error: '資産が見つかりません。' }, { status: 404 });
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// --- 部分更新 (PATCH) ---
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, location, manager, ownerid, department, updatedBy } = body;

    if (!id) return NextResponse.json({ error: 'IDが必要です。' }, { status: 400 });

    // 管理者(manager)を変更する場合のユーザー実在チェック
    if (manager) {
      const userExists = await prisma.accounts.findFirst({ where: { userid: manager } });
      if (!userExists) {
        return NextResponse.json({ error: `ユーザー「${manager}」は登録されていません。` }, { status: 400 });
      }
    }

    const data: any = {};
    if (status) data.status = status as AssetStatus;
    if (location !== undefined) data.location = location || null;
    if (manager !== undefined) data.manager = manager || null;
    if (ownerid !== undefined) data.ownerid = ownerid;
    if (department) data.department = department as Department;
    if (updatedBy) data.updatedBy = updatedBy;

    const updated = await prisma.items.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({ item: serializeItem(updated) }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// --- 削除 (DELETE) ---
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'IDが必要です。' }, { status: 400 });

    await prisma.items.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ error: '対象が見つかりません。' }, { status: 404 });
    return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}