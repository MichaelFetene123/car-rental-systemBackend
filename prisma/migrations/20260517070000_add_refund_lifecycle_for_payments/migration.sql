-- Extend payment statuses for asynchronous refund lifecycle
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'refund_initiated';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'refund_processing';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'refund_reversed';

-- Persist gateway refund tracking details
ALTER TABLE "payments"
  ADD COLUMN "refund_reference" VARCHAR(120),
  ADD COLUMN "refund_requested_at" TIMESTAMP(6),
  ADD COLUMN "refund_completed_at" TIMESTAMP(6);

CREATE INDEX "idx_payments_refund_reference"
  ON "payments"("refund_reference");
