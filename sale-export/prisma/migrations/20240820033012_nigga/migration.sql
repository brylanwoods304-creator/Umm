/*
  Warnings:

  - Made the column `invite_id` on table `workers` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "workers" DROP CONSTRAINT "workers_invite_id_fkey";

-- AlterTable
ALTER TABLE "workers" ALTER COLUMN "invite_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "Invite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
