export const STAFF = ['AGENT', 'MANAGER'];
export const CATEGORIES = [
  'REFUND',
  'CANCELLATION',
  'BOOKING_CHANGE',
  'CHECK_IN',
  'BAGGAGE',
  'OTHER',
];
export const STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_SUPPLIER',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const active = (status: string) =>
  !['RESOLVED', 'CLOSED'].includes(status);
export function classify(text: string): string {
  if (/refund|money back|reimburse/i.test(text)) return 'REFUND';
  if (/cancel/i.test(text)) return 'CANCELLATION';
  if (/check.?in|voucher|reception/i.test(text)) return 'CHECK_IN';
  if (/baggage|luggage/i.test(text)) return 'BAGGAGE';
  if (/\b(change|reschedul\w*|amend\w*|dates?)\b/i.test(text))
    return 'BOOKING_CHANGE';
  return 'OTHER';
}
export function deadlineFor(
  category: string,
  now: Date,
  checkInAt?: Date,
): Date {
  // Refunds have their own response target; a departed trip does not create travel urgency.
  const response = new Date(now.getTime() + 24 * 3600000);
  return category !== 'REFUND' && checkInAt && checkInAt > now
    ? new Date(Math.min(response.getTime(), checkInAt.getTime()))
    : response;
}
export function urgency(
  category: string,
  deadline: Date,
  checkInAt: Date | undefined,
  now: Date,
) {
  if (deadline <= now)
    return { priority: 'URGENT', reason: 'Response deadline breached' };
  if (category !== 'REFUND' && checkInAt && checkInAt > now) {
    const hours = (checkInAt.getTime() - now.getTime()) / 3600000;
    if (hours <= 6)
      return { priority: 'URGENT', reason: 'Check-in is within 6 hours' };
    if (hours <= 24)
      return { priority: 'HIGH', reason: 'Check-in is within 24 hours' };
  }
  return null;
}
export function chooseAgent<
  T extends { userId: string; region: string | null; available: boolean },
>(agents: T[], region: string, loads: Record<string, number>): T | undefined {
  return agents
    .filter(
      (a) => a.available && (a.region === region || a.region === 'GLOBAL'),
    )
    .sort(
      (a, b) =>
        (loads[a.userId] || 0) - (loads[b.userId] || 0) ||
        a.userId.localeCompare(b.userId),
    )[0];
}
