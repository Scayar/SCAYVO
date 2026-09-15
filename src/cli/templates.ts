export const CONFIG_TEMPLATE = `import { defineScayvo } from 'scayvo';

export default defineScayvo({
  version: 1,
  initialScene: 'empty',
  network: {
    scope: ['/api/'],
    onUnhandled: 'block',
  },
  managedStorage: {
    local: ['demo:theme'],
    session: ['demo:onboarding'],
  },
  defaults: {
    route: '/dashboard',
    storage: {
      local: { 'demo:theme': 'dark' },
      session: { 'demo:onboarding': 'complete' },
    },
    custom: {
      user: { id: 'demo-talal', name: 'Talal', plan: 'free' },
    },
    mocks: [
      {
        method: 'GET',
        path: '/api/orders',
        response: { status: 200, json: [] },
      },
      {
        method: 'GET',
        path: '/api/cart',
        response: {
          status: 200,
          json: { items: [{ id: 'camera', priceCents: 59900 }] },
        },
      },
      {
        method: 'POST',
        path: '/api/payment',
        response: { status: 200, json: { id: 'demo-payment', paid: true } },
      },
    ],
  },
  order: ['empty', 'busy'],
  scenes: {
    empty: {
      title: 'Empty dashboard',
    },
    busy: {
      title: 'Growing business',
      mocks: [{
        method: 'GET',
        path: '/api/orders',
        response: { status: 200, fixture: './scayvo/fixtures/orders.json' },
      }],
    },
  },
});
`;

export const DEV_TEMPLATE = `import { startScayvo } from 'scayvo/client';
import type { Adapter, Json, SceneContext } from 'scayvo';

let user: Json | null = null;

const userAdapter: Adapter = {
  async capture() {
    return user;
  },
  async apply(value: Json, context: SceneContext) {
    if (context.signal.aborted) throw new Error('aborted');
    user = value;
  },
  async restore(snapshot: Json, context: SceneContext) {
    if (context.signal.aborted) throw new Error('aborted');
    user = snapshot;
  },
};

export async function startDemoDevelopment() {
  const { mountApp } = await import('./bootstrap');
  await startScayvo({
    adapters: { user: userAdapter },
    integration: {
      async mount(context) {
        return mountApp(context);
      },
    },
  });
}
`;

export const FIXTURE_TEMPLATE = `[
  { "id": "demo-1001", "customer": "Demo Studio", "totalCents": 59900 },
  { "id": "demo-1002", "customer": "Sample Works", "totalCents": 12900 },
  { "id": "demo-1003", "customer": "Example Lab", "totalCents": 24900 }
]
`;

export const VITE_HINT = `
// vite.config.ts
import { scayvo } from 'scayvo/vite';
// plugins: [react(), scayvo()]
`;

export const MAIN_HINT = `
// src/main.ts
async function main() {
  if (import.meta.env.DEV) {
    const { startDemoDevelopment } = await import('./scayvo.dev');
    await startDemoDevelopment();
    return;
  }
  const { mountNormalApp } = await import('./bootstrap');
  await mountNormalApp();
}

void main();
`;
