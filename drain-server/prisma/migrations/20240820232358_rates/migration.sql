/*
  Warnings:

  - A unique constraint covering the columns `[currency]` on the table `rates` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "rates_currency_key" ON "rates"("currency");
