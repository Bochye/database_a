-- 申請の重複登録を防ぐ。送信ごとの識別番号を保存し、同じ識別番号の再送は1件として扱う。
ALTER TABLE "Requests" ADD COLUMN "clientRequestId" TEXT;

CREATE UNIQUE INDEX "Requests_clientRequestId_key" ON "Requests"("clientRequestId");
