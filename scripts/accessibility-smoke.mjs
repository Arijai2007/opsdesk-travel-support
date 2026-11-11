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
async function checkRoleKeyboard(page, role) {
  const launchers = ['Workspace guide', 'New ticket', 'Booking requests', 'Booking reviews'];
  for (const name of launchers) {
    const launcher = page.getByRole('button', {name, exact: true});
    if (!await launcher.count()) continue;
    await launcher.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const close = dialog.getByRole('button', {name: 'Close dialog'});
    assert(await close.evaluate((button) => button === document.activeElement), `${role}: ${name} initial focus`);
    await page.keyboard.press('Shift+Tab');
    assert(await dialog.evaluate((element) => element.contains(document.activeElement)),
      `${role}: ${name} reverse Tab stays in dialog`);
    await page.keyboard.press('Tab');
    assert(await close.evaluate((button) => button === document.activeElement),
      `${role}: ${name} Tab returns to close button`);
    await page.keyboard.press('Escape');
    await dialog.waitFor({state: 'hidden'});
    assert(await launcher.evaluate((button) => button === document.activeElement),
      `${role}: ${name} Escape restores launcher focus`);
  }
  const notifications = page.getByRole('button', {name: 'Notifications', exact: true});
  await notifications.focus();
  await page.keyboard.press('Enter');
  await page.locator('.od-notices').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.od-notices').waitFor({state: 'hidden'});
  assert(await notifications.evaluate((button) => button === document.activeElement),
    `${role}: Notifications Escape restores launcher focus`);
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
  await manager.getByRole('button', {name: 'Switch to dark theme'}).click();
  assert.equal(await manager.locator('.od-app').getAttribute('data-theme'), 'dark');
  await scan(manager, 'manager inbox dark theme');
  await manager.getByRole('button', {name: 'Booking reviews', exact: true}).click();
  await scan(manager, 'booking review dark theme');
  await manager.keyboard.press('Escape');
  await manager.getByRole('button', {name: 'New ticket', exact: true}).click();
  await scan(manager, 'new case intake dark theme');
  await manager.keyboard.press('Escape');
  await manager.reload();
  await manager.getByRole('button', {name: 'Switch to light theme'}).waitFor();
  assert.equal(await manager.locator('.od-app').getAttribute('data-theme'), 'dark', 'Theme persists after reload');
  await manager.getByRole('button', {name: 'Switch to light theme'}).click();
  assert.equal(await manager.locator('.od-app').getAttribute('data-theme'), 'light');
  // Catch controls pushed outside the page at the WCAG reflow width. Tables
  // may scroll within their own container; the workspace header must not.
  for (const width of [320, 375, 640, 900, 1024]) {
    await manager.setViewportSize({width, height: 800});
    const layout = await manager.locator('.od-topbar').evaluate((header) => ({
      viewport: window.innerWidth,
      right: header.getBoundingClientRect().right,
      controls: [...header.querySelectorAll('button')].map((button) => ({
        name: button.textContent || button.getAttribute('aria-label'),
        left: button.getBoundingClientRect().left,
        right: button.getBoundingClientRect().right,
      })),
    }));
    assert(layout.right <= layout.viewport + 1, `Header overflows at ${width}px`);
    for (const control of layout.controls) {
      assert(control.left >= 0 && control.right <= width + 1,
        `${control.name} falls outside the ${width}px viewport: ${JSON.stringify(control)}`);
    }
    await manager.getByRole('button', {name: 'Notifications', exact: true}).click();
    const notices = await manager.locator('.od-notices').evaluate((panel) => ({
      left: panel.getBoundingClientRect().left,
      right: panel.getBoundingClientRect().right,
    }));
    assert(notices.left >= 55 && notices.right <= width,
      `Notifications overlap navigation or leave the ${width}px viewport: ${JSON.stringify(notices)}`);
    await manager.keyboard.press('Escape');
    await manager.locator('.od-notices').waitFor({state: 'hidden'});
    assert.equal(await manager.locator('.od-notices').count(), 0, 'Escape dismisses notifications');
    assert(await manager.getByRole('button', {name: 'Notifications', exact: true})
      .evaluate((button) => button === document.activeElement), 'Notifications restores launcher focus');
    await manager.getByRole('button', {name: 'Booking reviews', exact: true}).focus();
    await manager.keyboard.press('Enter');
    const dialog = manager.getByRole('dialog', {name: 'Booking reviews', exact: true});
    await dialog.waitFor();
    await manager.keyboard.press('Escape');
    await dialog.waitFor({state: 'hidden'});
    assert(await manager.getByRole('button', {name: 'Booking reviews', exact: true})
      .evaluate((button) => button === document.activeElement), 'Dialog restores launcher focus');
    await manager.getByRole('button', {name: 'New ticket', exact: true}).click();
    const intakeDialog = manager.getByRole('dialog', {name: 'Start a conversation', exact: true});
    await intakeDialog.getByRole('button', {name: 'Older Booking', exact: true}).waitFor();
    const intakeWidth = await intakeDialog.evaluate((element) => ({
      client: element.clientWidth, scroll: element.scrollWidth,
    }));
    assert(intakeWidth.scroll <= intakeWidth.client + 1,
      `Intake requires horizontal scrolling at ${width}px: ${JSON.stringify(intakeWidth)}`);
    await manager.keyboard.press('Escape');
  }
  await manager.setViewportSize({width: 1280, height: 800});
  console.log('Reflow and keyboard: header controls, notification bounds/Escape/focus, booking dialog focus and intake pagination passed at 320, 375, 640, 900 and 1024px.');
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
  assert.equal(await manager.locator('.od-issue-column').count(), 3, 'Insights shows three record-driven 3D columns');
  await manager.getByRole('button', {name: 'Switch to dark theme'}).click();
  await scan(manager, 'manager insights dark theme');
  await manager.getByRole('button', {name: 'Switch to light theme'}).click();
  await manager.getByRole('button', {name: /All conversations/}).click();
  await manager.locator('.od-ticket-title').first().click();
  await manager.getByRole('region', {name: 'Case journey'}).waitFor();
  assert.equal(await manager.locator('.od-trajectory-stages li').count(), 4, 'Case journey has four saved-state steps');
  await scan(manager, 'case detail');
  await manager.getByRole('button', {name: 'Switch to dark theme'}).click();
  await scan(manager, 'case detail dark theme');
  await manager.getByRole('button', {name: 'Switch to light theme'}).click();
  await manager.getByRole('button', {name: 'Back to conversations'}).click();
  await checkRoleKeyboard(manager, 'manager');
  await manager.close();
  for (const role of ['maya', 'agency', 'asia', 'supplier']) {
    const page = await signIn(role);
    await scan(page, `${role} workspace`);
    await checkRoleKeyboard(page, role);
    await page.getByRole('button', {name: 'Switch to dark theme'}).click();
    await scan(page, `${role} workspace dark theme`);
    await page.getByRole('button', {name: 'Workspace guide', exact: true}).click();
    await scan(page, `${role} guide dark theme`);
    await page.keyboard.press('Escape');
    if (role === 'maya') {
      await page.getByRole('heading', {name: 'Your travel support', exact: true}).waitFor();
      await page.getByRole('button', {name: 'Switch to light theme'}).click();
      await page.getByRole('button', {name: 'View your bookings', exact: true}).click();
      await page.getByRole('heading', {name: 'Your bookings', exact: true}).waitFor();
      const cards = page.getByRole('list', {name: 'Your bookings'}).getByRole('listitem');
      await cards.first().waitFor();
      const expected = await page.evaluate(async () => {
        const result = await fetch('/api/backend/ops/bookings?page=1');
        if (!result.ok) throw new Error('Could not load scoped bookings');
        return (await result.json()).items.map((booking) => booking.reference);
      });
      assert.deepEqual(await cards.locator('.od-booking-ref').allTextContents(), expected);
      await scan(page, 'customer booking cards');
      await page.getByRole('button', {name: 'Switch to dark theme'}).click();
      await scan(page, 'customer booking cards dark theme');
      await page.setViewportSize({width: 320, height: 800});
      const overflow = await cards.first().evaluate((card) => card.scrollWidth > card.clientWidth + 1);
      assert.equal(overflow, false, 'Customer booking card fits at 320px');
      const history = cards.first().getByRole('button', {name: /case history/});
      await history.focus();
      await page.keyboard.press('Enter');
      assert.equal(await history.getAttribute('aria-expanded'), 'true');
      await cards.first().getByRole('navigation', {name: 'booking cases pagination'}).waitFor();
      await page.getByRole('button', {name: 'Booking requests', exact: true}).click();
      await page.getByRole('dialog', {name: 'Booking requests'}).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state: 'hidden'});
      await page.getByRole('button', {name: 'New ticket', exact: true}).click();
      await page.getByRole('dialog', {name: 'Start a conversation'}).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state: 'hidden'});
    }
    await page.close();
  }
  assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));
  console.log(`Accessibility ${engine}: ${scans} states passed axe WCAG A/AA checks. Manual assistive-technology acceptance remains required.`);
  console.log(`Accessibility ${engine}: keyboard dialog/notification focus checks passed across manager, traveler, agency, agent and supplier roles.`);
} finally { await browser.close(); }
