// クライアント側の通信を1か所にまとめる。
// 失敗を握りつぶさず、利用者に見せられる日本語のメッセージを必ず持たせる。

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload: any;

  constructor(message: string, status: number, payload?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.code = typeof payload?.error === 'string' ? payload.error : undefined;
  }

  // 再試行しても結果が変わる見込みがあるか（ボタンの出し分けに使う）
  get retryable() {
    return this.status === 0 || this.status === 409 || this.status >= 500;
  }
}

function messageForStatus(status: number) {
  if (status === 0) return 'サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。';
  if (status === 401 || status === 403) return 'この操作を行う権限がありません。再度ログインしてください。';
  if (status === 404) return '対象が見つかりません。既に削除された可能性があります。';
  if (status === 409) return '他の操作と競合しました。最新の内容を読み込んでから、もう一度お試しください。';
  if (status >= 500) return 'サーバー側で問題が発生しました。時間をおいて、もう一度お試しください。';
  return '処理に失敗しました。入力内容を確認してください。';
}

async function readBody(res: Response) {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  // JSON本文。指定するとContent-Typeを自動で付ける。
  json?: unknown;
  body?: BodyInit | null;
  // ステータス別の既定文言より優先したい文言
  fallbackMessage?: string;
};

/**
 * fetch のラッパー。HTTPエラーとネットワーク障害の両方を ApiError として投げる。
 * 呼び出し側は必ず catch して利用者に理由を伝えること。
 */
export async function apiFetch<T = any>(input: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, fallbackMessage, headers, ...init } = options;

  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: json === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    });
  } catch {
    throw new ApiError(messageForStatus(0), 0);
  }

  const payload = await readBody(res);

  if (!res.ok) {
    // サーバーが利用者向けの文言を返していればそれを優先する。
    // 'HAS_LINKED_ITEMS' のような制御用コードは画面に出さない。
    const isControlCode = (value: string) => /^[A-Z][A-Z0-9_]*$/.test(value);
    const serverMessage =
      typeof payload?.message === 'string' ? payload.message
      : typeof payload?.error === 'string' && !isControlCode(payload.error) ? payload.error
      : null;
    throw new ApiError(serverMessage || fallbackMessage || messageForStatus(res.status), res.status, payload);
  }

  return payload as T;
}

/**
 * 送信ごとの識別番号。通信が途中で切れて再送したとき、
 * サーバー側が「同じ送信の再試行」と判定できるようにする。
 */
export function newRequestKey(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
