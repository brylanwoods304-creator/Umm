CREATE TABLE IF NOT EXISTS "events" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "wallet" TEXT,
    "worker_id" INTEGER,
    "item" TEXT,
    "amount" INTEGER,
    "mode" TEXT,
    "ton_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usd_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ip" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "events_kind_created_at_idx" ON "events"("kind", "created_at");
CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events"("created_at");
