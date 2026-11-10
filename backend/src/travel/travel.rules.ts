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
  const complaint = text
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(
      /\b(?:do not|don't)\s+(?:(?:want|need)\s+(?:(?:a|any|to)\s+)?)?(?:refund\w*|cancel\w*)\b/g,
      '',
    );
  if (
    /\b(?:refund\w*|money back|reimburs\w*)\b|\b(?:reverse|return|credit back)\b[^.!?;]{0,45}\b(?:charge|payment|paid)\b/.test(
      complaint,
    )
  )
    return 'REFUND';
  if (
    /\bcancel\w*\b|\b(?:void|withdraw)\b[^.!?;]{0,55}\b(?:booking|reservation|ticket)\b/.test(
      complaint,
    )
  )
    return 'CANCELLATION';
  if (
    /\b(?:reschedul\w*|amend\w*)\b|\b(?:move|change|correct)\b[^.!?;]{0,55}\b(?:booking|reservation|arrival|check[ -]?in|dates?|ticket|name|time)\b/.test(
      complaint,
    ) ||
    /\b(?:move|change)\s+(?:(?:my|our|the|this|return|outbound|inbound)\s+){0,4}(?:flight|trip|seat|train)\b/.test(
      complaint,
    )
  )
    return 'BOOKING_CHANGE';
  if (
    /\b(?:baggage|luggage|suitcases?|carry[ -]?ons?|checked bags?)\b/.test(
      complaint,
    )
  )
    return 'BAGGAGE';
  if (
    /\b(?:check[ -]?in|voucher)\b|\b(?:reception|front desk)\b[^.!?;]{0,70}\b(?:can't find|cannot find|can't locate|cannot locate|can't see|doesn't recognize)\b/.test(
      complaint,
    )
  )
    return 'CHECK_IN';
  return 'OTHER';
}
export const RESPONSE_WINDOW_MS = 24 * 3600000;
export const CHECK_IN_HIGH_HOURS = 24;

export function responseDeadlineFor(now: Date, hours = 24) {
  return new Date(now.getTime() + hours * 3600000);
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
    if (hours <= CHECK_IN_HIGH_HOURS)
      return { priority: 'HIGH', reason: 'Check-in is within 24 hours' };
  }
  return null;
}
export function chooseAgent<
  T extends {
    userId: string;
    region: string | null;
    available: boolean;
    status?: string;
    specialties?: string[];
    maxActiveCases?: number | null;
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
        (a.status === undefined || a.status === 'ACTIVE') &&
        (a.region === region || a.region === 'GLOBAL') &&
        (a.maxActiveCases == null ||
          (loads[a.userId] ?? 0) < a.maxActiveCases) &&
        rank(a) < 2,
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (loads[a.userId] || 0) - (loads[b.userId] || 0) ||
        a.userId.localeCompare(b.userId),
    )[0];
}
