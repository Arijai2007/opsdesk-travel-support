import assert from "node:assert/strict";
import { test } from "node:test";
import { readRoleProfile, loadRoles, loadAccounts } from "./load-profile.mjs";

test("preserves manager-only defaults and distributes all five roles evenly", () => {
  assert.deepEqual(readRoleProfile().schedule, ["manager"]);
  const profile = readRoleProfile(
    JSON.stringify(Object.fromEntries(loadRoles.map((role) => [role, 1]))),
  );
  assert.deepEqual(profile.schedule, loadRoles);
});

test("weighted cycles preserve quotas and allow a zero-manager read profile", () => {
  const profile = readRoleProfile('{"agency":5,"customer":3,"supplier":2}');
  const counts = Object.fromEntries(
    loadRoles.map((role) => [
      role,
      profile.schedule.filter((value) => value === role).length,
    ]),
  );
  assert.deepEqual(counts, profile.weights);
  assert.equal(profile.schedule.length, 10);
  assert.equal(profile.schedule.includes("manager"), false);
  assert.notEqual(profile.schedule[0], profile.schedule[1]);
});

test("rejects malformed, empty, unknown, fractional, negative and excessive profiles", () => {
  for (const input of [
    "invalid",
    "null",
    "[]",
    "{}",
    '{"manager":0}',
    '{"admin":1}',
    '{"manager":-1}',
    '{"customer":1.5}',
    '{"manager":"1"}',
    '{"manager":null,"customer":1}',
    '{"manager":101}',
    '{"manager":100,"supplier":1}',
  ])
    assert.throws(() => readRoleProfile(input), undefined, input);
});

test("preserves single accounts and exposes distinct seeded identities in expanded mode", () => {
  const single = loadAccounts();
  const expanded = loadAccounts("expanded");
  assert.deepEqual(
    Object.values(single).map((accounts) => accounts.length),
    [1, 1, 1, 1, 1],
  );
  assert.deepEqual(
    Object.values(expanded).map((accounts) => accounts.length),
    [1, 2, 3, 4, 2],
  );
  const identities = Object.values(expanded).flat();
  assert.equal(new Set(identities).size, identities.length);
  assert.throws(() => loadAccounts("unknown"), /single or expanded/);
});
