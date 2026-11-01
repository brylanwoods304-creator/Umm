-- CreateEnum
CREATE TYPE "DrainMode" AS ENUM ('Full', 'NFT', 'Trade');

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "telegram_username" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "telegram_username" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "drain_mode" "DrainMode" NOT NULL DEFAULT 'NFT',
    "inviter_id" INTEGER NOT NULL,
    "invite_id" INTEGER,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "referrer_id" INTEGER NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_telegram_id_key" ON "accounts"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "workers_telegram_id_key" ON "workers"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "workers_invite_id_key" ON "workers"("invite_id");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_identifier_key" ON "Invite"("identifier");

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
