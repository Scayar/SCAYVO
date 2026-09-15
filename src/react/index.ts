import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';
import type { AppIntegration, MountedApp, SceneContext } from '../core/types.js';

export function createReactIntegration(
  target: HTMLElement,
  render: (context: SceneContext) => ReactNode,
): AppIntegration {
  return {
    async mount(context: SceneContext): Promise<MountedApp> {
      if (context.signal.aborted) {
        throw new Error('Mount aborted before render.');
      }
      const root: Root = createRoot(target);
      flushSync(() => {
        root.render(render(context));
      });
      return {
        async dispose() {
          flushSync(() => {
            root.unmount();
          });
        },
      };
    },
  };
}
