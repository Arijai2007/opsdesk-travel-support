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
export const RESPONSE_WINDOW_MS = 24 * 3600000;

export function responseDeadlineFor(now: Date) {
  return new Date(now.getTime() + RESPONSE_WINDOW_MS);
}

export function effectiveDeadline(
  category: string,
  responseDeadline: Date,
  booking: {
    checkInAt: Date;
    departureAt: Date | null;
    cancellationCutoffAt: Date | null;
  } | null,
  cycleStartedAt: Date,
) {
  if (!booking || category === 'REFUND') return responseDeadline;
  const travelDates = [booking.checkInAt, booking.departureAt];
  if (category === 'CANCELLATION')
    travelDates.push(booking.cancellationCutoffAt);
  return travelDates.reduce<Date>(
    (earliest, date) =>
      date && date >= cycleStartedAt && date < earliest ? date : earliest,
    responseDeadline,
  );
}
export function urgency(
  category: string,
  deadline: Date,
  checkInAt: Date | undefined,
  now: Date,
  responseDeadline?: Date | null,
) {
  if (deadline <= now)
    return {
      priority: 'URGENT',
      reason:
        responseDeadline && deadline < responseDeadline
          ? 'Travel deadline breached'
          : 'Response deadline breached',
    };
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
  T extends {
    userId: string;
    region: string | null;
    available: boolean;
    specialties?: string[];
  },
>(
  agents: T[],
  region: string,
  loads: Record<string, number>,
  category?: string,
): T | undefined {
  const rank = (agent: T) =>
    category && agent.specialties?.includes(category)
      ? 0
      : !category || !agent.specialties?.length
        ? 1
        : 2;
  return agents
    .filter(
      (a) =>
        a.available &&
        (a.region === region || a.region === 'GLOBAL') &&
        rank(a) < 2,
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (loads[a.userId] || 0) - (loads[b.userId] || 0) ||
        a.userId.localeCompare(b.userId),
    )[0];
}
