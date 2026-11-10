# Membership Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver working local invitation provisioning, reversible suspension and manager audit controls.

**Architecture:** Separate membership service/controllers use existing Prisma, auth and capacity lock. Next.js manager controls and a public activation BFF consume the exact API contract in the spec.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Next.js/React, existing validators, Playwright.

**Spec:** docs/superpowers/specs/2026-11-10-membership-admin-design.md

## Global Constraints
- Build locally; deployment preparation remains paused in the named Git stash.
- No deletion, historical scope reassignment, password disclosure, live email or deployment.
- Preserve five-role authorization, production checks and Node 22.23.x.
- Use one-time hashed invitations and live session-version checks.

## Review Focus
- A suspended/reinstated user's old tokens must stay invalid.
- Manager authority is rechecked under the shared capacity lock.
- Concurrent invitation acceptance must activate exactly once.
- Existing email accounts must never be taken over.
- Historical case ownership and privacy must survive suspension.

### Task 1: Membership model, API and authentication
**Files:** backend/prisma/schema.prisma and new migration; backend/src/travel/membership.*; backend/src/travel/travel.module.ts, travel.service.ts, travel.rules.ts; backend/src/auth/auth.service.ts and strategies/jwt.strategy.ts.
**Interfaces:** Exact routes, DTOs, page envelopes and statuses in spec.
- [ ] Write meaningful policy/auth tests first and observe failures.
- [ ] Implement schema, transactional manager actions, invitation acceptance, auditing and auth/session enforcement.
- [ ] Exclude inactive agents from routing and reassignment. Generate Prisma, build and run backend unit tests.

### Task 2: Manager and activation UI
**Files:** frontend/components/opsdesk/membership.tsx, workspace.tsx; frontend/app/activate/page.tsx; frontend/app/api/invitations/accept/route.ts.
**Interfaces:** Task 1 API; existing PageControls/useOpsPage and mutation conventions.
- [ ] Implement manager directory/provisioning/status/agency/supplier/audit controls and one-time link display.
- [ ] Implement fragment-based public activation and constrained public server proxy.
- [ ] Verify lint/build and full browser flow with explicit keyboard/error behavior.

### Task 3: Integration and evidence
**Files:** scripts/membership-smoke.mjs, scripts/membership-browser.mjs, package.json and relevant docs.
- [ ] Write real HTTP regression harness against isolated synthetic PostgreSQL and confirm missing endpoints fail before implementation.
- [ ] Verify spec invariants, concurrent acceptance, old sessions, permission denials and cleanup.
- [ ] Run existing suites, both browser engines, changed-file lint and whitespace checks.
- [ ] Obtain a fresh whole-branch review, fix material findings, document exact results and publish a reviewable feature PR.
