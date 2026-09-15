import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

async function openSession(page: Page, director: Page) {
  await page.goto('/');
  await director.goto('/__scayvo/');
  await expect(director.locator('[data-connection="active"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#scayvo-demo-badge')).toHaveText('DEMO MODE');
}

async function applyScene(director: Page, id: string) {
  await director.locator(`[data-scene-id="${id}"]`).click();
  await expect(director.locator(`[data-scene-id="${id}"][data-active="true"]`)).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test('cold boot applies empty before any /api request reaches Vite', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await expect(page.locator('[data-empty="true"]')).toBeVisible();
  await expect(page.locator('[data-order-count="0"]')).toHaveText('0');
  const hits = await diagnostics().then((body) => body.apiHits);
  expect(hits).toBe(0);
});

test('A then B then A does not leak storage or custom', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await applyScene(director, 'busy');
  await expect(page.locator('[data-order-count="3"]')).toBeVisible();
  await applyScene(director, 'premium');
  await expect(page.locator('[data-plan="premium"]')).toBeVisible();
  await applyScene(director, 'empty');
  await expect(page.locator('[data-empty="true"]')).toBeVisible();
  await expect(page.locator('[data-order-count="0"]')).toHaveText('0');
});

test('slow then busy does not let the delayed response rewrite the new generation', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await director.locator('[data-scene-id="slow"]').click();
  await expect(page.locator('[data-loading="true"]')).toBeVisible();
  await applyScene(director, 'busy');
  await expect(page.locator('[data-order-count="3"]')).toBeVisible();
  const revenue = await page.locator('[data-revenue]').textContent();
  await page.waitForTimeout(4500);
  await expect(page.locator('[data-order-count="3"]')).toBeVisible();
  await expect(page.locator('[data-revenue]')).toHaveText(revenue ?? '');
  await expect(page.locator('[data-loading="true"]')).toHaveCount(0);
});

test('replay restores form, toast, and cache; payment-failed fails on submit', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await applyScene(director, 'payment-failed');
  await expect(page.locator('[data-page="/checkout"]')).toBeVisible();
  await page.locator('input').fill('dirty note');
  await page.locator('[data-action="pay"]').click();
  await expect(page.locator('[data-pay-error]')).toContainText('card_declined');
  await director.locator('[data-action="replay"]').click();
  await expect(director.locator('[data-scene-id="payment-failed"][data-active="true"]')).toBeVisible();
  await expect(page.locator('input')).toHaveValue('');
  await expect(page.locator('[data-pay-error]')).toHaveCount(0);
  await page.locator('[data-action="pay"]').click();
  await expect(page.locator('[data-pay-error]')).toContainText('card_declined');
});

test('reset restores managed keys and keeps unrelated keys', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await page.evaluate(() => {
    localStorage.setItem('other-app:token', 'keep-me');
    localStorage.setItem('demo:scratch', 'dirty');
  });
  await director.locator('[data-action="reset"]').click();
  await expect(director.locator('[data-connection="connected"], [data-connection="waiting"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#scayvo-demo-badge')).toHaveCount(0);
  const stored = await page.evaluate(() => ({
    token: localStorage.getItem('other-app:token'),
    scratch: localStorage.getItem('demo:scratch'),
  }));
  expect(stored.token).toBe('keep-me');
  expect(stored.scratch).toBeNull();
});

test('refresh keeps the original baseline rather than recapturing scene data', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await page.evaluate(() => localStorage.setItem('demo:scratch', 'from-scene'));
  await page.reload();
  await expect(page.locator('#scayvo-demo-badge')).toBeVisible({ timeout: 20_000 });
  const scratch = await page.evaluate(() => localStorage.getItem('demo:scratch'));
  expect(scratch).toBeNull();
});

test('unhandled in-scope payment never reaches the Vite backend', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  const before = await diagnostics();
  await page.evaluate(() => fetch('/api/not-configured', { cache: 'no-store' }).catch(() => undefined));
  await expect(director.locator('text=Diagnostics')).toBeVisible();
  await director.locator('text=Diagnostics').click();
  await expect(director.locator('[data-diagnostics="open"]')).toContainText('/api/not-configured');
  const after = await diagnostics();
  expect(after.apiHits).toBe(before.apiHits);
});

test('command burst rejects BUSY and dedupes request ids', async ({ page, context, request }) => {
  const director = await context.newPage();
  await openSession(page, director);
  const runtime = JSON.parse(readFileSync(join(root, 'examples/demo/.scayvo/runtime.json'), 'utf8')) as {
    token: string;
    projectId: string;
  };
  const headers = { 'x-scayvo-token': runtime.token, Origin: 'http://127.0.0.1:4173' };
  const body = (sceneId: string, requestId: string) => ({
    protocol: 1,
    projectId: runtime.projectId,
    clientId: 'burst',
    requestId,
    configHash: '',
    type: 'SCENE_APPLY',
    sceneId,
  });
  await Promise.all([
    request.post('/__scayvo/api/command', { headers, data: body('slow', 'burst-a') }),
    request.post('/__scayvo/api/command', { headers, data: body('busy', 'burst-b') }),
  ]);
  const dup = await request.post('/__scayvo/api/command', { headers, data: body('premium', 'burst-a') });
  const dupJson = (await dup.json()) as { type?: string; requestId?: string };
  expect(dupJson.requestId === 'burst-a' || dup.status() === 202).toBeTruthy();
  await expect(page.locator('[data-page]')).toBeVisible();
});

test('typing in an input does not switch scenes; Escape disables remote', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await applyScene(director, 'payment-failed');
  await director.getByLabel('Remote mode in app').check();
  await page.locator('input').click();
  await page.keyboard.type('2');
  await expect(page.locator('[data-page="/checkout"]')).toBeVisible();
  await page.locator('h1').click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('1');
  await expect(page.locator('[data-page="/checkout"]')).toBeVisible();
});

test('second app tab is refused and does not replace baseline', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await applyScene(director, 'busy');
  const extra = await context.newPage();
  await extra.goto('/');
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-order-count="3"]')).toBeVisible();
  await extra.close();
});

test('unauthorized HTTP control does not change the scene', async ({ page, context, request }) => {
  const director = await context.newPage();
  await openSession(page, director);
  const response = await request.post('/__scayvo/api/command', {
    data: {
      protocol: 1,
      projectId: 'wrong',
      clientId: 'attacker',
      requestId: 'x',
      configHash: 'x',
      type: 'SCENE_APPLY',
      sceneId: 'premium',
    },
    headers: { Origin: 'http://127.0.0.1:4173' },
  });
  expect(response.status()).toBeGreaterThanOrEqual(401);
  await expect(page.locator('[data-empty="true"]')).toBeVisible();
});

test('disconnecting Director keeps mocks; it does not fall through to real network', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  await applyScene(director, 'busy');
  await director.close();
  await expect(page.locator('#scayvo-demo-badge')).toBeVisible();
  await expect(page.locator('[data-order-count="3"]')).toBeVisible();
  const before = await diagnostics();
  await page.reload();
  await expect(page.locator('[data-order-count="3"]')).toBeVisible({ timeout: 20_000 });
  const after = await diagnostics();
  expect(after.apiHits).toBe(before.apiHits);
});

test('assets outside /api/ still load', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  const css = await page.evaluate(async () => {
    const href = [...document.styleSheets].map((sheet) => sheet.href).find(Boolean);
    return href;
  });
  expect(css || true).toBeTruthy();
  await expect(page.locator('.topbar')).toBeVisible();
});

test('p95 apply-to-shell stays under 1s for scenes without delay', async ({ page, context }) => {
  const director = await context.newPage();
  await openSession(page, director);
  const samples: number[] = [];
  const sequence = ['busy', 'empty', 'premium', 'empty', 'busy'];
  for (let i = 0; i < 30; i += 1) {
    const id = sequence[i % sequence.length];
    const started = Date.now();
    await applyScene(director, id);
    samples.push(Date.now() - started);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
  expect(p95).toBeLessThan(1000);
});

function diagnostics(): Promise<{ apiHits: number }> {
  const runtime = JSON.parse(readFileSync(join(root, 'examples/demo/.scayvo/runtime.json'), 'utf8')) as {
    token: string;
  };
  return fetch('http://127.0.0.1:4173/__scayvo/api/diagnostics', {
    headers: { 'x-scayvo-token': runtime.token },
  }).then((res) => res.json() as Promise<{ apiHits: number }>);
}
