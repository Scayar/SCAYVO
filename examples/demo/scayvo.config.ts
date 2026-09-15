import { defineScayvo } from 'scayvo';

export default defineScayvo({
  version: 1,
  initialScene: 'empty',
  network: {
    scope: ['/api/'],
    onUnhandled: 'block',
  },
  managedStorage: {
    local: ['demo:theme', 'demo:scratch'],
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
          json: { items: [{ id: 'camera', name: 'Halo 35mm pack', priceCents: 59900 }] },
        },
      },
      {
        method: 'POST',
        path: '/api/payment',
        response: { status: 200, json: { id: 'demo-payment', paid: true } },
      },
    ],
  },
  order: ['empty', 'busy', 'slow', 'api-error', 'payment-failed', 'premium'],
  scenes: {
    empty: {
      title: 'Empty dashboard',
    },
    busy: {
      title: 'Growing business',
      mocks: [
        {
          method: 'GET',
          path: '/api/orders',
          response: { status: 200, fixture: './scayvo/fixtures/orders.json' },
        },
      ],
    },
    slow: {
      title: 'Slow API',
      mocks: [
        {
          method: 'GET',
          path: '/api/orders',
          delayMs: 4000,
          response: { status: 200, fixture: './scayvo/fixtures/orders.json' },
        },
      ],
    },
    'api-error': {
      title: 'Server error',
      mocks: [
        {
          method: 'GET',
          path: '/api/orders',
          response: { status: 500, json: { error: 'demo_server_error' } },
        },
      ],
    },
    'payment-failed': {
      title: 'Payment declined',
      route: '/checkout',
      mocks: [
        {
          method: 'POST',
          path: '/api/payment',
          delayMs: 800,
          response: { status: 402, json: { error: 'card_declined' } },
        },
      ],
    },
    premium: {
      title: 'Premium account',
      route: '/account',
      custom: {
        user: { id: 'demo-talal', name: 'Talal', plan: 'premium' },
      },
    },
  },
});
