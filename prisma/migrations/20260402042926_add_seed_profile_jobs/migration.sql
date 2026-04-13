-- CreateTable
CREATE TABLE "SeedProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "basicInfo" JSONB NOT NULL,
    "soulSeed" JSONB NOT NULL,
    "eventsSeed" JSONB NOT NULL,
    "sourceSessionIds" JSONB NOT NULL,
    "sourceSessionCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SeedProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeedJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SeedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeedJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SeedProfile_userId_idx" ON "SeedProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeedProfile_userId_version_key" ON "SeedProfile"("userId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SeedJob_sessionId_key" ON "SeedJob"("sessionId");

-- CreateIndex
CREATE INDEX "SeedJob_userId_status_idx" ON "SeedJob"("userId", "status");

-- CreateIndex
CREATE INDEX "SeedJob_createdAt_idx" ON "SeedJob"("createdAt");
