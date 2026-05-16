-- Booking lifecycle extension
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'no_show';

-- Payment lifecycle extension
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'partially_refunded';

-- Booking workflow audit fields
ALTER TABLE "bookings"
  ADD COLUMN "approved_at" TIMESTAMP(6),
  ADD COLUMN "activated_at" TIMESTAMP(6),
  ADD COLUMN "completed_at" TIMESTAMP(6),
  ADD COLUMN "rejected_at" TIMESTAMP(6),
  ADD COLUMN "cancelled_at" TIMESTAMP(6),
  ADD COLUMN "no_show_at" TIMESTAMP(6),
  ADD COLUMN "actual_returned_at" TIMESTAMP(6),
  ADD COLUMN "reviewed_by_user_id" UUID,
  ADD COLUMN "review_note" TEXT,
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "cancellation_reason" TEXT,
  ADD COLUMN "extra_charges" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "late_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "damage_notes" TEXT;

-- Payment workflow detail fields
ALTER TABLE "payments"
  ADD COLUMN "refunded_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "notes" TEXT;

-- Booking status transition history (audit-safe state changes)
CREATE TABLE "booking_status_transitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "from_status" "BookingStatus",
  "to_status" "BookingStatus" NOT NULL,
  "changed_by_user_id" UUID,
  "reason" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "booking_status_transitions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "booking_status_transitions"
  ADD CONSTRAINT "booking_status_transitions_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "idx_booking_status_transitions_booking_time"
  ON "booking_status_transitions"("booking_id", "created_at");

CREATE INDEX "idx_booking_status_transitions_to_status"
  ON "booking_status_transitions"("to_status");
