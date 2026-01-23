import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, RequestStatus, RequestType } from '@prisma/client';
import { userExists, unauthorizedResponse } from '../utils/validateUser';

const prisma = new PrismaClient();

/**
 * 申請一覧の取得 (GET)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get('requesterId') || '';
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

    return NextResponse.json({ requests }, { status: 200 });
  } catch (e) {
    console.error('GET Requests Error:', e);
    return NextResponse.json({ error: '申請データの取得に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 新規申請の作成 (POST)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, requesterId, type, note } = body;

    // バリデーション
    if (!itemId || !requesterId || !type) {
      return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 });
    }

    // ユーザーの存在確認
    if (!await userExists(requesterId)) {
      return unauthorizedResponse();
    }

    // 資産の状態確認（除却済みは申請不可）
    const item = await prisma.items.findUnique({ where: { id: Number(itemId) } });
    if (!item) {
      return NextResponse.json({ error: '資産が見つかりません。' }, { status: 404 });
    }
    if (item.status === 'DISPOSED') {
      return NextResponse.json({ error: '除却済みの資産には申請できません。' }, { status: 400 });
    }

    const created = await prisma.requests.create({
      data: {
        itemId: Number(itemId),
        requesterId,
        type: type as RequestType,
        note: note || null,      // 申請者の備考
        adminNote: null,         // 初期状態では管理者メモは空
        status: RequestStatus.PENDING, // デフォルトは保留
      },
      include: { item: true }
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (e) {
    console.error('POST Requests Error:', e);
    return NextResponse.json({ error: '申請の作成に失敗しました。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 申請状態の更新 (PATCH) - 管理者による承認・却下
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, note } = body; // フロントから届く 'note' は管理者の回答として扱う

    if (!id || !status) {
      return NextResponse.json({ error: 'IDとステータスは必須です。' }, { status: 400 });
    }

    // ステータスが正しいか検証
    if (!Object.values(RequestStatus).includes(status as RequestStatus)) {
      return NextResponse.json({ error: '無効なステータスです。' }, { status: 400 });
    }

    // 申請を取得して申請者IDを確認
    const request = await prisma.requests.findUnique({
      where: { id: Number(id) },
      select: { requesterId: true, itemId: true }
    });

    if (!request) {
      return NextResponse.json({ error: '申請が見つかりません。' }, { status: 404 });
    }

    // 更新処理
    const updated = await prisma.requests.update({
      where: { id: Number(id) },
      data: {
        status: status as RequestStatus,
        adminNote: note || null, // 管理者が入力したメモを adminNote カラムへ保存
      },
      include: { item: true }
    });

    // 承認された場合、備品の最終編集者を申請者に更新
    if (status === 'APPROVED') {
      await prisma.items.update({
        where: { id: request.itemId },
        data: {
          updatedBy: request.requesterId,
        }
      });
    }

    return NextResponse.json({ request: updated }, { status: 200 });
  } catch (e) {
    console.error('PATCH Requests Error:', e);
    // 対象が存在しない場合などのハンドリング
    return NextResponse.json({ error: '申請の更新に失敗しました。対象が存在しない可能性があります。' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}