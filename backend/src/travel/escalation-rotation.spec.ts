import { rotationOwner } from './escalation-rotation';
const rotation = {
  region: 'ASIA',
  managerIds: ['a', 'b', 'c'],
  anchorAt: new Date('2026-11-10T00:00:00Z'),
  slotHours: 8,
  version: 1,
};
const all = new Set(rotation.managerIds);
describe('UTC escalation rotation', () => {
  it.each([
    ['2026-11-10T00:00:00Z', 'a', 0],
    ['2026-11-10T07:59:59.999Z', 'a', 0],
    ['2026-11-10T08:00:00Z', 'b', 1],
    ['2026-11-10T16:00:00Z', 'c', 2],
    ['2026-11-11T00:00:00Z', 'a', 3],
    ['2026-11-09T23:59:59.999Z', 'c', -1],
  ])(
    'selects %s at an end-exclusive slot boundary',
    (instant, ownerId, slot) => {
      expect(rotationOwner(rotation, all, new Date(instant))).toEqual({
        ownerId,
        primaryId: ownerId,
        slot,
      });
    },
  );
  it('tries backups in cyclic roster order, not user-ID order', () => {
    expect(
      rotationOwner(
        rotation,
        new Set(['a', 'c']),
        new Date('2026-11-10T08:00:00Z'),
      ).ownerId,
    ).toBe('c');
  });
  it('wraps backup selection back to the start of the roster', () => {
    expect(
      rotationOwner(rotation, new Set(['a']), new Date('2026-11-10T16:00:00Z'))
        .ownerId,
    ).toBe('a');
  });
  it('does not silently use a manager outside the roster', () => {
    expect(
      rotationOwner(rotation, new Set(['outside']), rotation.anchorAt).ownerId,
    ).toBeNull();
  });
  it('returns to primary when coverage resumes', () => {
    expect(
      rotationOwner(rotation, new Set(['b']), rotation.anchorAt).ownerId,
    ).toBe('b');
    expect(rotationOwner(rotation, all, rotation.anchorAt).ownerId).toBe('a');
  });
  it('supports a one-person rotation', () => {
    expect(
      rotationOwner(
        { ...rotation, managerIds: ['a'] },
        all,
        new Date('2027-03-14T07:00:00Z'),
      ).ownerId,
    ).toBe('a');
  });
});
