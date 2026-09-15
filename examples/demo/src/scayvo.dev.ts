import { startScayvo } from 'scayvo/client';
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
