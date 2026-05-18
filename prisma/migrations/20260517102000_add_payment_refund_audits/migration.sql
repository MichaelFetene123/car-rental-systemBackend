CREATE TABLE "payment_refund_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "event_type" VARCHAR(60) NOT NULL,
  "request_reference" VARCHAR(120),
  "refund_reference" VARCHAR(120),
  "gateway_status" VARCHAR(40),
  "requested_amount" DECIMAL(10,2),
  "settled_amount" DECIMAL(10,2),
  "message" TEXT,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_refund_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_refund_audits_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_payment_refund_audits_payment_time"
  ON "payment_refund_audits"("payment_id", "created_at");

CREATE INDEX "idx_payment_refund_audits_booking_time"
  ON "payment_refund_audits"("booking_id", "created_at");

CREATE INDEX "idx_payment_refund_audits_ref_ref"
  ON "payment_refund_audits"("refund_reference");
