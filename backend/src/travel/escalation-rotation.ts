export const ROTATION_REGIONS = ['GLOBAL', 'ASIA', 'EUROPE', 'AMERICAS'];

export type EscalationRotation = {
  region: string;
  managerIds: string[];
  anchorAt: Date;
  slotHours: number;
  version: number;
};

// Slots are elapsed UTC hours. Floor and positive modulo also define dates
// before the anchor, without a locale/DST-dependent change in slot length.
export function rotationOwner(
  rotation: EscalationRotation,
  eligibleIds: Set<string>,
  now: Date,
) {
  const slot = Math.floor(
    (+now - +rotation.anchorAt) / (rotation.slotHours * 3600000),
  );
  const count = rotation.managerIds.length;
  const primaryIndex = ((slot % count) + count) % count;
  const order = Array.from(
    { length: count },
    (_, i) => rotation.managerIds[(primaryIndex + i) % count],
  );
  return {
    ownerId: order.find((id) => eligibleIds.has(id)) ?? null,
    primaryId: order[0],
    slot,
  };
}
