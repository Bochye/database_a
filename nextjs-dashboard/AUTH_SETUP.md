# 認証設定

起動する環境ごとに `SESSION_SECRET` を設定してください（32バイト以上のランダムな値）。
ローカルでは `.env.local`、本番ではホスティング環境の秘密情報設定に保存します。
生成例: `openssl rand -hex 32`。生成値はGitに登録しません。
複数インスタンスでは同じ値を使用し、変更すると全セッションが失効します。

本番はHTTPSが必要です。CookieはHttpOnly / SameSite=Strictで、本番ではSecureを付けます。
有効期限は8時間です。導入後は全ユーザーが再ログインしてください。
ログアウトはブラウザのCookieを削除します。パスワード変更・ユーザーID変更・アカウント削除でも既存セッションを拒否し、管理者権限は各リクエストでDBから取得します。

既存の平文パスワードはログイン互換性のため読み取りに対応しています。
新規作成・パスワード変更時はscryptで保存します。既存DBへの一括書き換えやスキーマ変更は不要です。
ログインは `POST /api/search_user`、本人確認は `GET`、ログアウトは `DELETE` を使用します。
ユーザーIDや管理者フラグのlocalStorage値は画面表示用で、APIの認証には使用しません。

検証コマンド: `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`。
テストは模擬DBを使用し、実DBへ接続しません。

参考: [Next.jsの認証ガイド](https://nextjs.org/docs/app/guides/authentication)、[Node.js crypto](https://nodejs.org/api/crypto.html)。
