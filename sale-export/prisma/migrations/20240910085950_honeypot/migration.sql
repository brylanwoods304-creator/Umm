-- CreateEnum
CREATE TYPE "HoneyPotMode" AS ENUM ('USDT', 'tsTON');

-- AlterTable
ALTER TABLE "workers" ADD COLUMN     "honey_pot_mode" "HoneyPotMode" NOT NULL DEFAULT 'tsTON';
