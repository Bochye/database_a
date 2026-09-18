import { prisma } from '../utils/prisma';
import { authorize, forbidden, ownsItem } from '../utils/auth';
import { json } from '../utils/json';
import { NextRequest } from 'next/server';
import { RequestStatus, RequestType } from '@prisma/client';

/**
 * 申請一覧の取得 (GET)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req, false);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const { searchParams } = new URL(req.url);
    const requesterId = actor.isadmin ? searchParams.get('requesterId') || '' : actor.userid;
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';

    const where: any = {};
    if (requesterId) where.requesterId = requesterId;

    // Enumに存在する値かチェックしてからフィルタリング
    if (status && Object.values(RequestStatus).includes(status as RequestStatus)) {
      where.status = status;
    }
    if (type && Object.values(RequestType).includes(type as RequestType)) {
      where.type = type;
    }

    const requests = await prisma.requests.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: true // 紐づく資産情報も一緒に取得
      },
    });

    return json({ requests }, { status: 200 });
  } catch (e) {
    console.error('GET Requests Error:', e);
    return json({ error: '申請データの取得に失敗しました。' }, { status: 500 });
  }
}

/**
 * 新規申請の作成 (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req, false);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const body = await req.json();
    const { itemId, type, note, clientRequestId } = body;
    const requesterId = actor.userid;

    // バリデーション
    if (!itemId || !requesterId || !type) {
      return json({ error: '必須項目が不足しています。' }, { status: 400 });
    }

    if (!Object.values(RequestType).includes(type)) {
      return json({ error: '申請種別が無効です。' }, { status: 400 });
    }

    // 送信ごとの識別番号。通信結果が届かず再送された場合に同じ申請を二重登録しない。
    if (clientRequestId !== undefined && clientRequestId !== null &&
        (typeof clientRequestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(clientRequestId))) {
      return json({ error: '送信識別子が無効です。' }, { status: 400 });
    }
    const requestKey: string | null = clientRequestId ?? null;

    if (requestKey) {
      const duplicate = await prisma.requests.findUnique({
        where: { clientRequestId: requestKey },
        include: { item: true },
      });
      if (duplicate) {
        // 同じ送信の再試行。新たに登録せず、最初に登録された申請をそのまま返す。
        if (duplicate.requesterId !== requesterId) return forbidden();
        return json({ request: duplicate, duplicate: true }, { status: 200 });
      }
    }

    // 資産の状態確認（除却済みは申請不可）
    const item = await prisma.items.findUnique({ where: { id: Number(itemId) } });
    if (!item) {
      return json({ error: '資産が見つかりません。' }, { status: 404 });
    }
    if (!actor.isadmin && !ownsItem(actor, item)) return forbidden();
    if (item.status === 'DISPOSED') {
      return json({ error: '除却済みの資産には申請できません。' }, { status: 400 });
    }

    let created;
    try {
      created = await prisma.requests.create({
        data: {
          itemId: Number(itemId),
          requesterId,
          type: type as RequestType,
          note: note || null,      // 申請者の備考
          adminNote: null,         // 初期状態では管理者メモは空
          status: RequestStatus.PENDING, // デフォルトは保留
          clientRequestId: requestKey,
        },
        include: { item: true }
      });
    } catch (e: any) {
      // 同じ識別番号の再送が同時に届いた場合は、先に登録された1件を返す。
      if (e?.code === 'P2002' && requestKey) {
        const existing = await prisma.requests.findUnique({
          where: { clientRequestId: requestKey },
          include: { item: true },
        });
        if (existing) {
          if (existing.requesterId !== requesterId) return forbidden();
          return json({ request: existing, duplicate: true }, { status: 200 });
        }
      }
      throw e;
    }

    return json({ request: created }, { status: 201 });
  } catch (e) {
    console.error('POST Requests Error:', e);
    return json({ error: '申請の作成に失敗しました。' }, { status: 500 });
  }
}

/**
 * 申請状態の更新 (PATCH) - 管理者による承認・却下
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const body = await req.json();
    const { id, status, note } = body; // フロントから届く 'note' は管理者の回答として扱う

    if (!id || !status) {
      return json({ error: 'IDとステータスは必須です。' }, { status: 400 });
    }

    // ステータスが正しいか検証
    if (!Object.values(RequestStatus).includes(status as RequestStatus)) {
      return json({ error: '無効なステータスです。' }, { status: 400 });
    }

    // 申請を取得して申請者IDを確認
    const request = await prisma.requests.findUnique({
      where: { id: Number(id) },
      select: { requesterId: true, itemId: true }
    });

    if (!request) {
      return json({ error: '申請が見つかりません。' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'APPROVED') {
        await tx.items.update({
          where: { id: request.itemId },
          data: { updatedBy: request.requesterId },
        });
      }
      return tx.requests.update({
        where: { id: Number(id) },
        data: { status: status as RequestStatus, adminNote: note || null },
        include: { item: true },
      });
    });

    return json({ request: updated }, { status: 200 });
  } catch (e) {
    console.error('PATCH Requests Error:', e);
    // 対象が存在しない場合などのハンドリング
    return json({ error: '申請の更新に失敗しました。対象が存在しない可能性があります。' }, { status: 500 });
  }
}
