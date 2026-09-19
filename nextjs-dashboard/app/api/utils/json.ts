import { NextResponse } from 'next/server';

// 関連レコード内の取得価額も変換する。画面が扱える範囲は数値で維持する。
export function json(data: unknown, init?: ResponseInit) {
  const serialized = JSON.stringify(data, (_key, value) => {
    if (typeof value !== 'bigint') return value;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value.toString();
  });
  return new NextResponse(serialized, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...init?.headers },
  });
}
