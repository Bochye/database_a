import { prisma } from '../utils/prisma';
import { authorize } from '../utils/auth';
import { json } from '../utils/json';
import { NextRequest } from 'next/server';
import { AssetStatus, Department } from '@prisma/client';

// --- 一覧取得 (GET) ---
// 閲覧権限と本人情報はサーバーで検証したセッションから取得する
export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req, false);
    if (auth.response) return auth.response;
    const actor = auth.account;
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
    const isAdmin = actor.isadmin && searchParams.get('isAdmin') !== 'false';
    const onlyMine = searchParams.get('onlyMine') === 'true';
    // ログイン中のユーザー名を特定するためのパラメータ
    const currentUserName = actor.userid;

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
        return json({ items: [] }, { status: 200 });
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

    return json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error fetching items:', error);
    return json({ error: '資産データの取得に失敗しました。' }, { status: 500 });
  }
}

// 日付バリデーション用ヘルパー関数
function parseAndValidateDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null; // Invalid Date
  return date;
}

// 楽観ロック用。クライアントが編集を始めた時点の更新日時を検証する。
function parseExpectedUpdatedAt(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new RangeError('更新日時の形式が無効です。');
  }
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) throw new RangeError('更新日時の形式が無効です。');
  return date;
}

/**
 * 更新日時を照合しながら資産を更新する。
 * 照合に失敗した場合は他の利用者が先に保存しているため、上書きせず最新の内容を返す。
 */
async function updateItemWithLock(id: number, data: any, expectedUpdatedAt: Date | null) {
  if (!expectedUpdatedAt) {
    return { conflict: false as const, item: await prisma.items.update({ where: { id }, data }) };
  }

  const result = await prisma.items.updateMany({
    where: { id, updatedAt: expectedUpdatedAt },
    data,
  });

  if (result.count === 0) {
    const current = await prisma.items.findUnique({ where: { id } });
    if (!current) {
      const error: any = new Error('NOT_FOUND');
      error.code = 'P2025';
      throw error;
    }
    return { conflict: true as const, item: current };
  }

  return { conflict: false as const, item: await prisma.items.findUnique({ where: { id } }) };
}

const CONFLICT_MESSAGE = 'この資産は他の利用者によって更新されています。最新の内容を読み込んでから、もう一度保存してください。';

function parseCost(value: unknown): bigint | null {
  if (value == null || value === '') return null;
  if ((typeof value !== 'string' || !/^\d+$/.test(value)) &&
      (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError('取得価額は0以上の整数で入力してください。');
  }
  const cost = BigInt(value as string | number);
  if (cost > BigInt('9223372036854775807')) throw new RangeError('取得価額が大きすぎます。');
  return cost;
}

// --- 新規登録 (POST) ---
export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const body = await req.json();
    const {
      assetCode, name, modelNumber, acquisitionDate, disposalDate,
      acquisitionCost, manager, location, status, stock, department
    } = body;

    if (!assetCode || !name) {
      return json({ error: '必須項目が不足しています。' }, { status: 400 });
    }

    // 日付のバリデーション
    const acqDate = parseAndValidateDate(acquisitionDate);
    const dispDate = parseAndValidateDate(disposalDate);

    if (acquisitionDate && !acqDate) {
      return json({ error: '取得日の形式が無効です。' }, { status: 400 });
    }
    if (disposalDate && !dispDate) {
      return json({ error: '廃棄日の形式が無効です。' }, { status: 400 });
    }
    if (acqDate && dispDate && dispDate < acqDate) {
      return json({ error: '廃棄日は取得日より後の日付にしてください。' }, { status: 400 });
    }

    const newItem = await prisma.items.create({
      data: {
        assetCode,
        name,
        modelNumber: modelNumber || null,
        acquisitionDate: acqDate,
        disposalDate: dispDate,
        acquisitionCost: parseCost(acquisitionCost),
        manager: manager || null,
        location: location || null,
        status: (status as AssetStatus) || AssetStatus.USED,
        stock: stock != null ? Number(stock) : 0,
        ownerid: actor.userid,
        department: (department as Department) || Department.CS,
        updatedBy: actor.userid,
      },
    });

    return json({ item: newItem }, { status: 201 });
  } catch (error: any) {
    if (error instanceof RangeError) return json({ error: error.message }, { status: 400 });
    const msg = error?.code === 'P2002' ? '資産コードが重複しています。' : '資産の追加に失敗しました。';
    return json({ error: msg }, { status: 500 });
  }
}

// --- 全更新 (PUT) ---
export async function PUT(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const body = await req.json();
    const {
      id, assetCode, name, modelNumber, acquisitionDate, disposalDate,
      acquisitionCost, manager, location, status, stock, department, expectedUpdatedAt
    } = body;

    if (!id || !assetCode || !name) {
      return json({ error: '更新に必要な項目が不足しています。' }, { status: 400 });
    }

    // 日付のバリデーション
    const acqDate = parseAndValidateDate(acquisitionDate);
    const dispDate = parseAndValidateDate(disposalDate);

    if (acquisitionDate && !acqDate) {
      return json({ error: '取得日の形式が無効です。' }, { status: 400 });
    }
    if (disposalDate && !dispDate) {
      return json({ error: '廃棄日の形式が無効です。' }, { status: 400 });
    }
    if (acqDate && dispDate && dispDate < acqDate) {
      return json({ error: '廃棄日は取得日より後の日付にしてください。' }, { status: 400 });
    }

    const { conflict, item: updatedItem } = await updateItemWithLock(
      Number(id),
      {
        assetCode,
        name,
        modelNumber: modelNumber || null,
        acquisitionDate: acqDate,
        disposalDate: dispDate,
        acquisitionCost: parseCost(acquisitionCost),
        manager: manager || null,
        location: location || null,
        status: (status as AssetStatus) || AssetStatus.USED,
        stock: stock != null ? Number(stock) : 0,
        department: department === undefined ? undefined : department as Department,
        updatedBy: actor.userid,
      },
      parseExpectedUpdatedAt(expectedUpdatedAt),
    );

    if (conflict) {
      return json({ error: CONFLICT_MESSAGE, current: updatedItem }, { status: 409 });
    }

    return json({ item: updatedItem }, { status: 200 });
  } catch (error: any) {
    if (error instanceof RangeError) return json({ error: error.message }, { status: 400 });
    if (error.code === 'P2025') return json({ error: '資産が見つかりません。' }, { status: 404 });
    return json({ error: '更新に失敗しました。' }, { status: 500 });
  }
}

// --- 部分更新 (PATCH) ---
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const body = await req.json();
    const { id, status, location, manager, department, expectedUpdatedAt } = body;

    if (!id) return json({ error: 'IDが必要です。' }, { status: 400 });

    // 管理者(manager)を変更する場合のユーザー実在チェック
    if (manager) {
      const userExists = await prisma.accounts.findFirst({ where: { userid: manager } });
      if (!userExists) {
        return json({ error: `ユーザー「${manager}」は登録されていません。` }, { status: 400 });
      }
    }

    const data: any = {};
    if (status) data.status = status as AssetStatus;
    if (location !== undefined) data.location = location || null;
    if (manager !== undefined) data.manager = manager || null;
    // 作成者は部分更新でも保持する。
    if (department) data.department = department as Department;
    data.updatedBy = actor.userid;

    const { conflict, item: updated } = await updateItemWithLock(
      Number(id),
      data,
      parseExpectedUpdatedAt(expectedUpdatedAt),
    );

    if (conflict) {
      return json({ error: CONFLICT_MESSAGE, current: updated }, { status: 409 });
    }

    return json({ item: updated }, { status: 200 });
  } catch (error: any) {
    if (error instanceof RangeError) return json({ error: error.message }, { status: 400 });
    if (error?.code === 'P2025') return json({ error: '資産が見つかりません。' }, { status: 404 });
    return json({ error: '更新に失敗しました。' }, { status: 500 });
  }
}

// --- 削除 (DELETE) ---
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return json({ error: 'IDが必要です。' }, { status: 400 });

    await prisma.items.delete({ where: { id: Number(id) } });
    return json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2025') return json({ error: '対象が見つかりません。' }, { status: 404 });
    return json({ error: '削除に失敗しました。' }, { status: 500 });
  }
}
