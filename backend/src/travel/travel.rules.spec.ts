import { chooseAgent, classify, deadlineFor, urgency } from './travel.rules';
describe('travel policy decisions', () => {
  const now = new Date('2026-11-09T10:00:00Z');
  const later = (hours: number) => new Date(now.getTime() + hours * 3600000);
  it('keeps a post-trip refund on its own response target', () => {
    expect(deadlineFor('REFUND', now, later(-24))).toEqual(later(24));
    expect(urgency('REFUND', later(24), later(2), now)).toBeNull();
  });
  it('uses the earlier check-in deadline for an unresolved service issue', () => {
    expect(deadlineFor('CHECK_IN', now, later(4))).toEqual(later(4));
    expect(urgency('CHECK_IN', later(24), later(4), now)?.priority).toBe(
      'URGENT',
    );
  });
  it('raises a near check-in to high, then urgent at the six-hour boundary', () => {
    expect(
      urgency('BOOKING_CHANGE', later(24), later(6.1), now)?.priority,
    ).toBe('HIGH');
    expect(urgency('BOOKING_CHANGE', later(24), later(6), now)?.priority).toBe(
      'URGENT',
    );
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
