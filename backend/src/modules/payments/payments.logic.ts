import type { PaymentHistoryRow, PaymentMilestoneRow } from "./payments.repo.js";

export function sumPaidTotalMnt(
  payments: Array<Pick<PaymentHistoryRow, "amount_mnt" | "status">>,
) {
  return payments.reduce((acc, row) => {
    if (String(row.status || "").toLowerCase() !== "paid") return acc;
    const amount = Number(row.amount_mnt || 0);
    return Number.isFinite(amount) ? acc + amount : acc;
  }, 0);
}

export function dueAtMs(value: string | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

export function isMilestoneDeadlineExpired(
  milestone: Pick<PaymentMilestoneRow, "due_at">,
  nowMs = Date.now(),
) {
  const dueMs = dueAtMs(milestone.due_at);
  return Number.isFinite(dueMs) && dueMs <= nowMs;
}

export function selectDefaultPayableMilestone(
  unpaidMilestones: PaymentMilestoneRow[],
) {
  if (unpaidMilestones.length === 0) {
    return null;
  }

  const nowMs = Date.now();
  const overdue = unpaidMilestones.filter((milestone) => {
    if (!milestone.due_at) return false;
    const due = new Date(milestone.due_at).getTime();
    return Number.isFinite(due) && due <= nowMs;
  });

  if (overdue.length > 0) {
    return overdue.reduce((best, current) => {
      const bestRequired = Number(best.required_cumulative_mnt || 0);
      const currentRequired = Number(current.required_cumulative_mnt || 0);

      if (currentRequired > bestRequired) {
        return current;
      }

      if (currentRequired < bestRequired) {
        return best;
      }

      return dueAtMs(current.due_at) < dueAtMs(best.due_at) ? current : best;
    });
  }

  return [...unpaidMilestones].sort(
    (a, b) => dueAtMs(a.due_at) - dueAtMs(b.due_at),
  )[0];
}

export function computeMilestoneAmountToPay(
  targetMilestone: Pick<PaymentMilestoneRow, "required_cumulative_mnt">,
  payments: Array<Pick<PaymentHistoryRow, "amount_mnt" | "status">>,
) {
  const paidTotal = sumPaidTotalMnt(payments);
  const requiredCumulative = Number(targetMilestone.required_cumulative_mnt || 0);
  return Math.max(0, Math.round(requiredCumulative - paidTotal));
}

export function isPaidStatus(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized === "paid" ||
    normalized === "success" ||
    normalized === "completed" ||
    normalized.includes("paid")
  );
}
