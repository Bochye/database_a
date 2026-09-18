import { prisma } from '../utils/prisma';
import { authorize, forbidden, ownsItem } from '../utils/auth';
import { json } from '../utils/json';
import { NextRequest } from 'next/server';
import { AssetStatus } from '@prisma/client';

/**
 * 【GET】棚卸し報告一覧、ユーザー別進捗統計、および現在のラウンド情報を取得
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req, false);
    if (auth.response) return auth.response;
    const actor = auth.account;
    // 1. 現在アクティブな棚卸しラウンドを取得
    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });

    // アクティブなラウンドがない場合は早期リターン
    if (!currentRound) {
      return json({
        requests: [],
        userStats: {},
        currentRound: null
      });
    }

    if (!actor.isadmin) {
      const requests = await prisma.inventoryRecords.findMany({
        where: { roundId: currentRound.id, ownerId: actor.userid },
        include: { item: true, round: true },
        orderBy: { confirmedAt: 'desc' },
      });
      return json({ requests, userStats: {}, currentRound });
    }

    // 2. 今回のラウンドの全回答を取得
    const currentRecords = await prisma.inventoryRecords.findMany({
      where: { roundId: currentRound.id, ...(actor.isadmin ? {} : { ownerId: actor.userid }) },
      include: {
        item: true,
        round: true // フロントエンドでタイトルを引くため
      },
      orderBy: { confirmedAt: 'desc' }
    });

    // 3. 今回の棚卸しで報告された資産IDのセット
    const reportedItemIds = new Set(currentRecords.map(r => (r as any).itemId));

    // 4. 分母用の資産を取得
    // - 除却済み以外の資産 OR
    // - 今回の棚卸しで報告された資産（除却報告含む）
    const allTargetItems = await prisma.items.findMany({
      where: {
        OR: [
          { status: { not: 'DISPOSED' } },
          { id: { in: Array.from(reportedItemIds) as number[] } }
        ]
      }
    });

    const userStats: Record<string, any> = Object.create(null);

    // 5. 統計の集計ロジック
    // 全資産から「本来報告すべき件数」をユーザーごとにセット
    allTargetItems.forEach(item => {
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
    return json({
      requests: currentRecords,
      userStats,
      currentRound
    }, { status: 200 });

  } catch (e) {
    console.error('Inventory GET error:', e);
    return json({ error: 'データ取得に失敗しました', userStats: {} }, { status: 500 });
  }
}

/**
 * 【POST】ユーザーからの棚卸し報告（個数 newStock を含む）
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req, false);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const body = await req.json();
    const { itemId, newStatus, newLocation, newStock } = body;
    const userId = actor.userid;

    if (!Number.isSafeInteger(Number(itemId)) || Number(itemId) <= 0 ||
        (newStatus != null && !Object.values(AssetStatus).includes(newStatus)) ||
        (newStock != null && (!Number.isInteger(Number(newStock)) || Number(newStock) < 0))) {
      return json({ error: '報告内容が無効です。' }, { status: 400 });
    }
    const item = await prisma.items.findUnique({ where: { id: Number(itemId) } });
    if (!item) return json({ error: '資産が見つかりません。' }, { status: 404 });
    if (!ownsItem(actor, item)) return forbidden();

    const currentRound = await prisma.inventoryRounds.findFirst({
      where: { isCurrent: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!currentRound) {
      return json({ error: '現在アクティブな棚卸し期間がありません。' }, { status: 400 });
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
          newLocation: newLocation === undefined ? item.location : newLocation,
          newStatus: (newStatus ?? item.status) as AssetStatus,
          newStock: newStock != null ? Number(newStock) : item.stock,
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
          newLocation: newLocation === undefined ? item.location : newLocation,
          newStatus: (newStatus ?? item.status) as AssetStatus,
          newStock: newStock != null ? Number(newStock) : item.stock,
          isApproved: false,
          status: 'PENDING',
          item: { connect: { id: Number(itemId) } },
          round: { connect: { id: currentRound.id } }
        } as any,
      });
    } else {
      return json({ error: '既に報告済みです。' }, { status: 400 });
    }

    return json({ record }, { status: 201 });
  } catch (e) {
    console.error('Inventory POST error:', e);
    return json({ error: '報告の登録に失敗しました。' }, { status: 500 });
  }
}

/**
 * 【PATCH】管理者が報告内容を資産台帳（Items）に適用する / 再申請を依頼する
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const { userId, recordId, action } = await req.json();

    // 個別適用
    if (action === 'APPROVE_SINGLE' && recordId) {
      const record = await prisma.inventoryRecords.findUnique({
        where: { id: Number(recordId) },
        include: { round: true }
      });

      if (!record) {
        return json({ error: 'レコードが見つかりません。' }, { status: 404 });
      }

      if (!record.round.isCurrent || record.status !== 'PENDING') {
        return json({ error: '現在の未適用報告のみ適用できます。' }, { status: 409 });
      }

      // 状態確認と更新の間に他の管理者が適用した場合に備え、
      // 「PENDING のままであること」を条件に更新し、取れたときだけ台帳へ反映する。
      const applied = await prisma.$transaction(async (tx) => {
        const claimed = await tx.inventoryRecords.updateMany({
          where: { id: Number(recordId), status: 'PENDING' } as any,
          data: { isApproved: true, status: 'APPROVED' } as any
        });

        if (claimed.count === 0) return false;

        await tx.items.update({
          where: { id: (record as any).itemId },
          data: {
            location: record.newLocation,
            status: record.newStatus as AssetStatus,
            stock: (record as any).newStock ?? undefined,
            updatedBy: record.ownerId
          }
        });

        return true;
      });

      if (!applied) {
        return json({ error: 'この報告は既に他の操作で処理されています。画面を更新して最新の状態を確認してください。' }, { status: 409 });
      }

      return json({ success: true });
    }

    // 再申請依頼
    if (action === 'REQUEST_RESUBMIT' && recordId) {
      const record = await prisma.inventoryRecords.findUnique({
        where: { id: Number(recordId) },
        include: { round: true }
      });

      if (!record) {
        return json({ error: 'レコードが見つかりません。' }, { status: 404 });
      }

      if (!record.round.isCurrent) {
        return json({ error: '終了済みの棚卸しです。' }, { status: 409 });
      }

      // 判定時点の状態から変わっていないことを条件にする。
      const requested = await prisma.inventoryRecords.updateMany({
        where: { id: Number(recordId), status: record.status } as any,
        data: {
          status: 'RESUBMIT_REQUESTED',
          isApproved: false
        } as any
      });

      if (requested.count === 0) {
        return json({ error: 'この報告は既に他の操作で処理されています。画面を更新して最新の状態を確認してください。' }, { status: 409 });
      }

      return json({ success: true });
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
        return json({ message: '適用対象の未承認データがありません。' });
      }

      // 1件ずつ「PENDING のままであること」を条件に確保してから台帳へ反映する。
      // 他の管理者が同時に適用した分は二重に反映せず、件数として利用者へ伝える。
      const { applied, skipped } = await prisma.$transaction(async (tx) => {
        let applied = 0;
        let skipped = 0;

        for (const record of pendingRecords) {
          const claimed = await tx.inventoryRecords.updateMany({
            where: { id: record.id, status: 'PENDING' } as any,
            data: { isApproved: true, status: 'APPROVED' } as any
          });

          if (claimed.count === 0) {
            skipped += 1;
            continue;
          }

          await tx.items.update({
            where: { id: (record as any).itemId },
            data: {
              location: record.newLocation,
              status: record.newStatus as AssetStatus,
              stock: (record as any).newStock ?? undefined,
              updatedBy: record.ownerId
            }
          });
          applied += 1;
        }

        return { applied, skipped };
      });

      if (applied === 0) {
        return json({ error: 'これらの報告は既に他の操作で処理されています。画面を更新して最新の状態を確認してください。' }, { status: 409 });
      }

      return json({ success: true, applied, skipped });
    }
    return json({ error: '無効なアクションです。' }, { status: 400 });
  } catch (e) {
    console.error('Inventory PATCH error:', e);
    return json({ error: '処理に失敗しました。' }, { status: 500 });
  }
}
