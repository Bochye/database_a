import { prisma } from '../utils/prisma';
import { authorize, accountSelect, hashPassword } from '../utils/auth';
import { json } from '../utils/json';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

// 管理者が1人もいなくなる更新を止めるための合図。トランザクションを巻き戻す。
class LastAdminError extends Error {
  constructor() {
    super('LAST_ADMIN');
    this.name = 'LastAdminError';
  }
}

// 同時に実行された降格・削除が互いに見えず、結果として管理者が0人になるのを防ぐ。
const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

// 管理者が最低1人残っていることをトランザクション内で確認する。
async function ensureAdminRemains(tx: any) {
  const remaining = await tx.accounts.count({ where: { isadmin: true } });
  if (remaining < 1) throw new LastAdminError();
}

// トランザクションが競合で中断された場合（Serializable の直列化失敗など）
function isConflict(e: any) {
  return e?.code === 'P2034' || e?.code === '40001';
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req, false);
    if (auth.response) return auth.response;
    const actor = auth.account;
    const { searchParams } = new URL(req.url);
    const userid = searchParams.get('userid');
    // userid指定があれば特定検索、なければ全件取得
    const accounts = await prisma.accounts.findMany({
      where: actor.isadmin ? (userid ? { userid } : {}) : { id: actor.id },
      select: accountSelect,
      orderBy: { id: 'asc' },
    });
    return json({ accounts }, { status: 200 });
  } catch (e) {
    return json({ error: '取得に失敗しました。' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const body = await req.json();
    const { userid, password, isadmin, department } = body;
    if (typeof userid !== 'string' || !userid || typeof password !== 'string' || !password || password.length > 1024) return json({ error: '入力不足です' }, { status: 400 });

    // ユーザーIDの重複チェック
    const existing = await prisma.accounts.findFirst({ where: { userid } });
    if (existing) {
      return json({ error: 'このユーザーIDは既に使用されています。' }, { status: 409 });
    }

    const created = await prisma.accounts.create({
      data: { userid, password: await hashPassword(password), isadmin: !!isadmin, department: department || 'CS' },
      select: accountSelect,
    });
    return json({ account: created }, { status: 201 });
  } catch (e) {
    return json({ error: '作成に失敗しました。' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const body = await req.json();
    const { id, userid, password, isadmin, department } = body;

    if (!id) return json({ error: 'id が必要です。' }, { status: 400 });

    // 現在のユーザー情報を取得して、古い userid を確認する
    const currentUser = await prisma.accounts.findUnique({
      where: { id: Number(id) }
    });

    if (!currentUser) {
      return json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    const oldUserId = currentUser.userid;

    // ユーザーIDを変更する場合、重複チェック
    if (userid && userid !== oldUserId) {
      const existing = await prisma.accounts.findFirst({ where: { userid } });
      if (existing) {
        return json({ error: 'このユーザーIDは既に使用されています。' }, { status: 409 });
      }
    }

    if (password !== undefined && (typeof password !== 'string' || password.length > 1024)) {
      return json({ error: 'パスワードが無効です。' }, { status: 400 });
    }
    const hashedPassword = password ? await hashPassword(password) : undefined;

    // トランザクションを使用して、ユーザーと資産を同時に更新
    const result = await prisma.$transaction(async (tx) => {
      // 1. ユーザー情報の更新
      const updatedAccount = await tx.accounts.update({
        where: { id: Number(id) },
        data: {
          ...(userid ? { userid } : {}),
          ...(hashedPassword ? { password: hashedPassword } : {}),
          ...(department ? { department } : {}),
          ...(typeof isadmin === 'boolean' ? { isadmin } : {}),
        },
        select: accountSelect,
      });

      // 2. ユーザーIDを参照する全フィールドを同一トランザクションで更新
      if (userid && userid !== oldUserId) {
        await tx.items.updateMany({
          where: { manager: oldUserId },
          data: { manager: userid }
        });
        await tx.items.updateMany({ where: { ownerid: oldUserId }, data: { ownerid: userid } });
        await tx.items.updateMany({ where: { updatedBy: oldUserId }, data: { updatedBy: userid } });
        await tx.requests.updateMany({ where: { requesterId: oldUserId }, data: { requesterId: userid } });
        await tx.inventoryRecords.updateMany({ where: { ownerId: oldUserId }, data: { ownerId: userid } });
        await tx.inventoryRequests.updateMany({ where: { userId: oldUserId }, data: { userId: userid } });
        await tx.inventoryRounds.updateMany({ where: { createdBy: oldUserId }, data: { createdBy: userid } });
      }

      // 管理者から一般ユーザーへ降格する場合、管理者が0人にならないことを確認する。
      if (isadmin === false && currentUser.isadmin) {
        await ensureAdminRemains(tx);
      }

      return updatedAccount;
    }, serializable);

    return json({ account: result }, { status: 200 });
  } catch (e) {
    if (e instanceof LastAdminError) {
      return json({ error: '最後の管理者を一般ユーザーに変更することはできません。先に別の管理者を登録してください。' }, { status: 409 });
    }
    if (isConflict(e)) {
      return json({ error: '他の操作と競合しました。最新の内容を読み込んでから、もう一度お試しください。' }, { status: 409 });
    }
    console.error(e);
    return json({ error: '更新に失敗しました。' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authorize(req, true);
    if (auth.response) return auth.response;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const transferTo = searchParams.get('transferTo'); // 引継ぎ先のuserid

    if (!id) {
      return json({ error: 'id が必要です。' }, { status: 400 });
    }

    // 削除対象のアカウント情報を取得
    const targetAccount = await prisma.accounts.findUnique({
      where: { id: Number(id) }
    });

    if (!targetAccount) {
      return json({ error: 'アカウントが見つかりません。' }, { status: 404 });
    }

    // このアカウントに紐づく備品を検索（manager = 実際の使用者）
    const linkedItems = await prisma.items.findMany({
      where: { manager: targetAccount.userid },
      select: {
        id: true,
        assetCode: true,
        name: true,
        location: true,
        status: true,
      }
    });

    // 紐づき備品がある場合
    if (linkedItems.length > 0) {
      // 引継ぎ先が指定されていない場合は、備品一覧を返して削除をブロック
      if (!transferTo) {
        return json({
          error: 'HAS_LINKED_ITEMS',
          message: 'このアカウントには備品が紐づいています。引継ぎ先を指定してください。',
          linkedItems,
          itemCount: linkedItems.length
        }, { status: 409 });
      }

      if (transferTo === targetAccount.userid) {
        return json({ error: '別のアカウントを引継ぎ先に指定してください。' }, { status: 400 });
      }

      // 引継ぎ先アカウントの存在確認
      const transferTarget = await prisma.accounts.findFirst({
        where: { userid: transferTo }
      });

      if (!transferTarget) {
        return json({ error: '引継ぎ先のアカウントが見つかりません。' }, { status: 404 });
      }

      // トランザクションで備品の引継ぎとアカウント削除を実行
      await prisma.$transaction(async (tx) => {
        // 1. 備品の使用者(manager)を変更
        await tx.items.updateMany({
          where: { manager: targetAccount.userid },
          data: { manager: transferTo }
        });

        // 2. owneridフィールドも更新（念のため）
        await tx.items.updateMany({
          where: { ownerid: targetAccount.userid },
          data: { ownerid: transferTo }
        });

        // 3. アカウントを削除
        await tx.accounts.delete({ where: { id: Number(id) } });

        // 4. 管理者が0人にならないことを確認する
        if (targetAccount.isadmin) await ensureAdminRemains(tx);
      }, serializable);

      return json({
        message: '引継ぎ完了後、削除しました',
        transferredCount: linkedItems.length
      }, { status: 200 });
    }

    // 紐づき備品がない場合はそのまま削除
    await prisma.$transaction(async (tx) => {
      await tx.accounts.delete({ where: { id: Number(id) } });
      if (targetAccount.isadmin) await ensureAdminRemains(tx);
    }, serializable);
    return json({ message: '削除完了' }, { status: 200 });
  } catch (e) {
    if (e instanceof LastAdminError) {
      return json({ error: '最後の管理者は削除できません。先に別の管理者を登録してください。' }, { status: 409 });
    }
    if (isConflict(e)) {
      return json({ error: '他の操作と競合しました。最新の内容を読み込んでから、もう一度お試しください。' }, { status: 409 });
    }
    console.error(e);
    return json({ error: '削除に失敗しました。' }, { status: 500 });
  }
}
