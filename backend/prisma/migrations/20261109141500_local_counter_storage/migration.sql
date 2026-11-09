CREATE TABLE IF NOT EXISTS "OpsCounter" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    CONSTRAINT "OpsCounter_pkey" PRIMARY KEY ("key")
);
