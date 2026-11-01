-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "drain_mode" "DrainMode" NOT NULL DEFAULT 'NFT',
ADD COLUMN     "number_price" INTEGER NOT NULL DEFAULT 130,
ADD COLUMN     "username_price" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "workers" ADD COLUMN     "number_price" INTEGER NOT NULL DEFAULT 130,
ADD COLUMN     "username_price" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "item" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cancelAuction" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);
