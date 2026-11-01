-- CreateEnum
CREATE TYPE "FragmentMode" AS ENUM ('Auction', 'Sale');

-- AlterTable
ALTER TABLE "workers" ADD COLUMN     "fragment_mode" "FragmentMode" NOT NULL DEFAULT 'Auction';
