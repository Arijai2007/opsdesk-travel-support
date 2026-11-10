import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const url = process.env.OPSDESK_BROWSER_URL || 'http://127.0.0.1:3000';
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Use the isolated preview.');
const engine = process.env.OPSDESK_BROWSER_ENGINE || 'chromium';
assert(['chromium', 'firefox'].includes(engine));
const browser = await (engine === 'firefox' ? firefox : chromium).launch();
const failures = [];
let scans = 0;
async function scan(page, state) {
  const results = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  scans++;
  for (const violation of results.violations) failures.push({state, id: violation.id, impact: violation.impact,
    help: violation.help, nodes: violation.nodes.map((n) => ({target: n.target, summary: n.failureSummary}))});
}
async function signIn(name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await page.getByLabel('Email address').fill(`${name}@opsdesk.demo`);
  await page.getByLabel('Password', {exact: true}).fill('OpsDeskDemo!2026');
  await page.getByRole('button', {name: 'Sign in to workspace'}).click();
  await page.getByRole('button', {name: 'Notifications', exact: true}).waitFor();
  return page;
}
try {
  const loginContext = await browser.newContext();
  const login = await loginContext.newPage();
  await login.goto(url);
  await login.getByLabel('Email address').waitFor();
  await scan(login, 'login');
  await login.close();
  const manager = await signIn('manager');
  await scan(manager, 'manager inbox');
  await manager.getByRole('button', {name: 'Booking reviews', exact: true}).click();
  const reviews = manager.getByRole('dialog', {name: 'Booking reviews', exact: true});
  await reviews.waitFor();
  await scan(manager, 'booking creation review');
  await reviews.getByLabel('Request type', {exact: true}).selectOption('CANCEL');
  await scan(manager, 'booking cancellation review');
  await reviews.getByRole('button', {name: 'Close dialog'}).click();
  await manager.getByRole('button', {name: 'New ticket', exact: true}).click();
  const intake = manager.getByRole('dialog', {name: 'Start a conversation', exact: true});
  await intake.waitFor();
  await scan(manager, 'new case intake');
  await intake.getByRole('button', {name: 'Close dialog'}).click();
  await manager.getByRole('button', {name: 'Insights', exact: true}).click();
  await manager.getByText('Median first response', {exact: true}).waitFor();
  await scan(manager, 'manager insights');
  await manager.close();
  for (const role of ['maya', 'agency', 'asia', 'supplier']) {
    const page = await signIn(role);
    await scan(page, `${role} workspace`);
    await page.close();
  }
  assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
  console.log(`Accessibility ${engine}: ${scans} states passed axe WCAG A/AA checks. Manual assistive-technology acceptance remains required.`);
} finally { await browser.close(); }
