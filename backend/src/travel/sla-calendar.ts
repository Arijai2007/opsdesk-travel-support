export type ServiceCalendar = {
  timeZone: string;
  week: { day: number; start: number; end: number }[];
  holidays: string[];
};
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string) {
  let value = formatters.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    if (formatters.size > 100) formatters.clear();
    formatters.set(zone, value);
  }
  return value;
}
export function validateCalendar(value: unknown): ServiceCalendar {
  if (!value || typeof value !== 'object')
    throw new Error('Calendar must be an object.');
  const c = value as ServiceCalendar;
  if (typeof c.timeZone !== 'string' || c.timeZone.length > 80)
    throw new Error('An IANA time zone is required.');
  formatter(c.timeZone).format(new Date());
  if (!Array.isArray(c.week) || !c.week.length || c.week.length > 28)
    throw new Error('Provide 1-28 weekly intervals.');
  if (!Array.isArray(c.holidays) || c.holidays.length > 100)
    throw new Error('At most 100 holidays are supported.');
  for (const date of c.holidays) {
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new Error('Holiday dates must be valid YYYY-MM-DD values.');
  }
  const week = c.week
    .map((w) => {
      if (
        !w ||
        !Number.isInteger(w.day) ||
        w.day < 0 ||
        w.day > 6 ||
        !Number.isInteger(w.start) ||
        !Number.isInteger(w.end) ||
        w.start < 0 ||
        w.end > 1440 ||
        w.start >= w.end
      )
        throw new Error(
          'Intervals use day 0-6 and increasing minutes 0-1440. Split overnight coverage at midnight.',
        );
      return { day: w.day, start: w.start, end: w.end };
    })
    .sort((a, b) => a.day - b.day || a.start - b.start);
  for (let i = 1; i < week.length; i++)
    if (week[i].day === week[i - 1].day && week[i].start < week[i - 1].end)
      throw new Error('Working intervals must not overlap.');
  return {
    timeZone: c.timeZone,
    week,
    holidays: [...new Set(c.holidays)].sort(),
  };
}
export function isOnDuty(calendar: ServiceCalendar | null, now: Date): boolean {
  if (!calendar) return true;
  const parts = Object.fromEntries(
    formatter(calendar.timeZone)
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  if (calendar.holidays.includes(`${parts.year}-${parts.month}-${parts.day}`))
    return false;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    parts.weekday,
  );
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return calendar.week.some(
    (w) => w.day === day && minute >= w.start && minute < w.end,
  );
}
// Walk actual UTC minutes: skipped local minutes contribute no time; repeated
// DST minutes contribute their real duration. Budget precision stays in ms.
const LIMIT = 366 * 24 * 3600000;
export function addServiceTime(
  start: Date,
  milliseconds: number,
  calendar: ServiceCalendar | null,
): Date {
  if (
    !Number.isFinite(milliseconds) ||
    milliseconds < 0 ||
    !Number.isFinite(+start)
  )
    throw new Error('Invalid service budget.');
  if (!calendar) return new Date(+start + milliseconds);
  let cursor = +start,
    remaining = milliseconds;
  while (remaining > 0) {
    if (cursor - +start > LIMIT)
      throw new Error('No sufficient service coverage within 366 days.');
    const step = 60000 - (((cursor % 60000) + 60000) % 60000);
    if (isOnDuty(calendar, new Date(cursor))) {
      const consumed = Math.min(step, remaining);
      cursor += consumed;
      remaining -= consumed;
    } else cursor += step;
  }
  return new Date(cursor);
}
export function serviceTimeBetween(
  start: Date,
  end: Date,
  calendar: ServiceCalendar | null,
): number {
  if (+end <= +start) return 0;
  if (!calendar) return +end - +start;
  if (+end - +start > LIMIT)
    throw new Error('Service interval exceeds 366 days.');
  let cursor = +start,
    total = 0;
  while (cursor < +end) {
    const step = Math.min(
      60000 - (((cursor % 60000) + 60000) % 60000),
      +end - cursor,
    );
    if (isOnDuty(calendar, new Date(cursor))) total += step;
    cursor += step;
  }
  return total;
}
export function chooseEscalationOwner(
  managers: {
    userId: string;
    kind: string;
    status: string;
    available: boolean;
    shiftCalendar: ServiceCalendar | null;
  }[],
  now: Date,
  current: string | null,
): string | null {
  const eligible = managers
    .filter(
      (m) =>
        m.kind === 'MANAGER' &&
        m.status === 'ACTIVE' &&
        m.available &&
        isOnDuty(m.shiftCalendar, now),
    )
    .sort((a, b) => a.userId.localeCompare(b.userId));
  return (
    eligible.find((m) => m.userId === current)?.userId ??
    eligible[0]?.userId ??
    null
  );
}
