/*
  Warnings:

  - You are about to drop the column `drain_mode` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `number_price` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `username_price` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `invite_id` on the `workers` table. All the data in the column will be lost.
  - You are about to drop the column `inviter_id` on the `workers` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `workers` table. All the data in the column will be lost.
  - You are about to drop the `Invite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Item` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Invite" DROP CONSTRAINT "Invite_referrer_id_fkey";

-- DropForeignKey
ALTER TABLE "workers" DROP CONSTRAINT "workers_invite_id_fkey";

-- DropForeignKey
ALTER TABLE "workers" DROP CONSTRAINT "workers_inviter_id_fkey";

-- DropIndex
DROP INDEX "workers_invite_id_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "drain_mode",
DROP COLUMN "number_price",
DROP COLUMN "username_price",
ADD COLUMN     "workerId" INTEGER;

-- AlterTable
ALTER TABLE "workers" DROP COLUMN "invite_id",
DROP COLUMN "inviter_id",
DROP COLUMN "is_active",
ADD COLUMN     "logging_chat" TEXT;

-- DropTable
DROP TABLE "Invite";

-- DropTable
DROP TABLE "Item";

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
