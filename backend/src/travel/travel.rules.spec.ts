import {
  chooseAgent,
  classify,
  effectiveDeadline,
  responseDeadlineFor,
  urgency,
} from './travel.rules';
describe('travel policy decisions', () => {
  const now = new Date('2026-11-09T10:00:00Z');
  const later = (hours: number) => new Date(now.getTime() + hours * 3600000);
  it('keeps a post-trip refund on its own response target', () => {
    const booking = {
      checkInAt: later(-24),
      departureAt: later(-23),
      cancellationCutoffAt: later(-48),
    };
    expect(
      effectiveDeadline('REFUND', responseDeadlineFor(now), booking, now),
    ).toEqual(later(24));
    expect(urgency('REFUND', later(24), later(2), now)).toBeNull();
  });
  it('uses the earlier check-in deadline for an unresolved service issue', () => {
    const booking = {
      checkInAt: later(4),
      departureAt: later(6),
      cancellationCutoffAt: later(2),
    };
    expect(
      effectiveDeadline('CHECK_IN', responseDeadlineFor(now), booking, now),
    ).toEqual(later(4));
    expect(urgency('CHECK_IN', later(24), later(4), now)?.priority).toBe(
      'URGENT',
    );
  });
  it('uses cancellation cutoff only for cancellations and records a travel breach', () => {
    const booking = {
      checkInAt: later(20),
      departureAt: later(10),
      cancellationCutoffAt: later(4),
    };
    const response = responseDeadlineFor(now);
    expect(effectiveDeadline('CANCELLATION', response, booking, now)).toEqual(
      later(4),
    );
    expect(effectiveDeadline('BOOKING_CHANGE', response, booking, now)).toEqual(
      later(10),
    );
    expect(
      urgency('CANCELLATION', later(4), booking.checkInAt, later(5), response)
        ?.reason,
    ).toBe('Travel deadline breached');
  });
  it('raises a near check-in to high, then urgent at the six-hour boundary', () => {
    expect(
      urgency('BOOKING_CHANGE', later(24), later(6.1), now)?.priority,
    ).toBe('HIGH');
    expect(urgency('BOOKING_CHANGE', later(24), later(6), now)?.priority).toBe(
      'URGENT',
    );
  });
  it('prefers qualified specialists and excludes unrelated or unavailable specialists', () => {
    const specialist = {
      userId: 'refund',
      region: 'ASIA',
      available: true,
      specialties: ['REFUND'],
    };
    const generalist = {
      userId: 'global',
      region: 'GLOBAL',
      available: true,
      specialties: [],
    };
    expect(
      chooseAgent([specialist, generalist], 'ASIA', { refund: 4 }, 'REFUND'),
    ).toBe(specialist);
    expect(chooseAgent([specialist, generalist], 'ASIA', {}, 'CHECK_IN')).toBe(
      generalist,
    );
    expect(
      chooseAgent(
        [{ ...specialist, available: false }, generalist],
        'ASIA',
        {},
        'REFUND',
      ),
    ).toBe(generalist);
  });
  it('escalates a missed response target even for a refund', () => {
    expect(urgency('REFUND', later(-1), undefined, now)?.reason).toBe(
      'Response deadline breached',
    );
  });
  it('assigns the least-loaded available eligible agent, including global coverage', () => {
    const agents = [
      { userId: 'asia', region: 'ASIA', available: true },
      { userId: 'eu', region: 'EUROPE', available: true },
      { userId: 'away', region: 'ASIA', available: false },
      { userId: 'global', region: 'GLOBAL', available: true },
    ];
    expect(
      chooseAgent(agents, 'ASIA', { asia: 5, eu: 0, away: 0, global: 2 })
        ?.userId,
    ).toBe('global');
    expect(
      chooseAgent(
        agents.filter((a) => a.region !== 'GLOBAL'),
        'AMERICAS',
        {},
      ),
    ).toBeUndefined();
  });
  it('classifies cancellation-fee text separately from refunds and retains an other fallback', () => {
    expect(classify('My refund after cancellation is still pending')).toBe(
      'REFUND',
    );
    expect(classify('Please confirm the cancellation fee')).toBe(
      'CANCELLATION',
    );
    expect(classify('The hotel voucher is missing')).toBe('CHECK_IN');
    expect(classify('Please help me')).toBe('OTHER');
    expect(classify('Please give me an update')).toBe('OTHER');
  });
});
