-- CreateTable
CREATE TABLE "Outpass" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fromDay" TIMESTAMP(3) NOT NULL,
    "toDay" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "requestedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isRejected" BOOLEAN NOT NULL DEFAULT false,
    "issuedBy" TEXT NOT NULL DEFAULT 'none',
    "issuedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,
    "rejectedBy" TEXT NOT NULL DEFAULT 'none',
    "rejectedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentLevel" TEXT NOT NULL DEFAULT 'caretaker',
    "approvalLogs" JSONB,

    CONSTRAINT "Outpass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outing" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fromTime" TIMESTAMP(3) NOT NULL,
    "toTime" TIMESTAMP(3) NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "requestedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isRejected" BOOLEAN NOT NULL DEFAULT false,
    "issuedBy" TEXT NOT NULL DEFAULT 'none',
    "issuedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,
    "rejectedBy" TEXT NOT NULL DEFAULT 'none',
    "rejectedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentLevel" TEXT NOT NULL DEFAULT 'caretaker',
    "approvalLogs" JSONB,

    CONSTRAINT "Outing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Outpass_studentId_idx" ON "Outpass"("studentId");

-- CreateIndex
CREATE INDEX "Outpass_isApproved_isRejected_isExpired_idx" ON "Outpass"("isApproved", "isRejected", "isExpired");

-- CreateIndex
CREATE INDEX "Outing_studentId_idx" ON "Outing"("studentId");

-- CreateIndex
CREATE INDEX "Outing_isApproved_isRejected_isExpired_idx" ON "Outing"("isApproved", "isRejected", "isExpired");
