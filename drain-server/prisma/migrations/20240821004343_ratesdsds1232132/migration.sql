-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_workerId_fkey";

-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "workerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
