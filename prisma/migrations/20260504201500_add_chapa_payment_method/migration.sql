-- Add missing Chapa payment method to the enum in existing databases.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'chapa';
