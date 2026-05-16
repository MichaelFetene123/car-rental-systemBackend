import { Prisma } from '../../generated/prisma/client';

export type PaymentLike = {
  amount: Prisma.Decimal | number;
  refundedAmount: Prisma.Decimal | number;
  status: string;
};

export type PaymentSummary = {
  totalCompleted: number;
  totalRefunded: number;
  pendingPayments: number;
  netPaid: number;
  hasCompletedPayment: boolean;
  hasNetPayment: boolean;
};

const toNumber = (value: Prisma.Decimal | number) =>
  typeof value === 'number' ? value : Number(value);

export const summarizePayments = (payments: PaymentLike[]): PaymentSummary => {
  const totalCompleted = payments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  const totalRefunded = payments
    .filter((payment) =>
      ['refunded', 'partially_refunded'].includes(payment.status),
    )
    .reduce((sum, payment) => sum + toNumber(payment.refundedAmount), 0);

  const pendingPayments = payments.filter(
    (payment) => payment.status === 'pending',
  ).length;

  const netPaid = totalCompleted - totalRefunded;

  return {
    totalCompleted,
    totalRefunded,
    pendingPayments,
    netPaid,
    hasCompletedPayment: totalCompleted > 0,
    hasNetPayment: netPaid > 0,
  };
};

export const isPaymentCovered = (
  summary: PaymentSummary,
  requiredAmount: Prisma.Decimal | number,
) => summary.netPaid >= toNumber(requiredAmount);
