-- CreateTable
CREATE TABLE "Accounts" (
    "id" SERIAL NOT NULL,
    "userid" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isadmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Accounts_pkey" PRIMARY KEY ("id")
);
