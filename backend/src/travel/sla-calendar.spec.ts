import {
  addServiceTime,
  serviceTimeBetween,
  isOnDuty,
  validateCalendar,
  chooseEscalationOwner,
} from './sla-calendar';
const weekday = {
  timeZone: 'Europe/London',
  week: [1, 2, 3, 4, 5].map((day) => ({ day, start: 540, end: 1020 })),
  holidays: [] as string[],
};
const at = (iso: string) => new Date(iso);
const hours = 3600000;
describe('SLA calendar contract', () => {
  it('retains elapsed hours without an explicit calendar', () =>
    expect(
      addServiceTime(at('2026-11-06T16:00:00Z'), 4 * hours, null).toISOString(),
    ).toBe('2026-11-06T20:00:00.000Z'));
  it('crosses weekends using business time', () =>
    expect(
      addServiceTime(
        at('2026-11-06T16:00:00Z'),
        4 * hours,
        weekday,
      ).toISOString(),
    ).toBe('2026-11-09T12:00:00.000Z'));
  it('skips local holidays', () =>
    expect(
      addServiceTime(at('2026-11-06T16:00:00Z'), 4 * hours, {
        ...weekday,
        holidays: ['2026-11-09'],
      }).toISOString(),
    ).toBe('2026-11-10T12:00:00.000Z'));
  it('handles a half-hour zone', () =>
    expect(
      addServiceTime(at('2026-11-09T03:00:00Z'), hours, {
        ...weekday,
        timeZone: 'Asia/Kolkata',
      }).toISOString(),
    ).toBe('2026-11-09T04:30:00.000Z'));
  it('does not invent nonexistent spring-forward minutes', () =>
    expect(
      addServiceTime(at('2026-03-08T06:00:00Z'), 2 * hours, {
        timeZone: 'America/New_York',
        week: [{ day: 0, start: 60, end: 240 }],
        holidays: [],
      }).toISOString(),
    ).toBe('2026-03-08T08:00:00.000Z'));
  it('counts both real occurrences in the autumn fold', () =>
    expect(
      addServiceTime(at('2026-11-01T05:00:00Z'), 3 * hours, {
        timeZone: 'America/New_York',
        week: [{ day: 0, start: 60, end: 180 }],
        holidays: [],
      }).toISOString(),
    ).toBe('2026-11-01T08:00:00.000Z'));
  it('preserves sub-minute budget', () =>
    expect(
      addServiceTime(at('2026-11-09T09:00:15Z'), 45000, weekday).toISOString(),
    ).toBe('2026-11-09T09:01:00.000Z'));
  it('counts only service time for a paused budget', () =>
    expect(
      serviceTimeBetween(
        at('2026-11-06T16:00:00Z'),
        at('2026-11-09T12:00:00Z'),
        weekday,
      ),
    ).toBe(4 * hours));
  it('resumes a remaining budget at the next open interval', () =>
    expect(
      addServiceTime(
        at('2026-11-07T12:00:00Z'),
        2 * hours,
        weekday,
      ).toISOString(),
    ).toBe('2026-11-09T11:00:00.000Z'));
  it('uses end-exclusive coverage', () =>
    expect(isOnDuty(weekday, at('2026-11-09T17:00:00Z'))).toBe(false));
  it('keeps legacy coverage with no shift configured', () =>
    expect(isOnDuty(null, at('2026-11-08T23:00:00Z'))).toBe(true));
  it.each([
    { ...weekday, timeZone: 'Unknown/Zone' },
    { ...weekday, week: [] },
    { ...weekday, holidays: ['2026-02-30'] },
    { ...weekday, week: [{ day: 1, start: 1020, end: 540 }] },
    {
      ...weekday,
      week: [
        { day: 1, start: 540, end: 700 },
        { day: 1, start: 600, end: 800 },
      ],
    },
  ])('rejects invalid or ambiguous coverage %#', (value) =>
    expect(() => validateCalendar(value)).toThrow(),
  );
  it('hands escalation to an active on-duty manager', () =>
    expect(
      chooseEscalationOwner(
        [
          {
            userId: 'off',
            kind: 'MANAGER',
            status: 'ACTIVE',
            available: true,
            shiftCalendar: weekday,
          },
          {
            userId: 'on',
            kind: 'MANAGER',
            status: 'ACTIVE',
            available: true,
            shiftCalendar: null,
          },
        ],
        at('2026-11-08T12:00:00Z'),
        'off',
      ),
    ).toBe('on'));
  it('leaves escalation unowned without coverage', () =>
    expect(
      chooseEscalationOwner(
        [
          {
            userId: 'off',
            kind: 'MANAGER',
            status: 'SUSPENDED',
            available: true,
            shiftCalendar: null,
          },
        ],
        at('2026-11-08T12:00:00Z'),
        null,
      ),
    ).toBeNull());
  it('uses the calendar local date for holidays across UTC midnight', () => {
    const calendar = {
      ...weekday,
      timeZone: 'Asia/Kolkata',
      holidays: ['2026-11-09'],
    };
    expect(
      addServiceTime(at('2026-11-08T20:00:00Z'), hours, calendar).toISOString(),
    ).toBe('2026-11-10T04:30:00.000Z');
  });
  it('keeps a zero budget unchanged at a closed boundary', () =>
    expect(
      addServiceTime(at('2026-11-08T12:00:00Z'), 0, weekday).toISOString(),
    ).toBe('2026-11-08T12:00:00.000Z'));
});
