import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { MountedApp, SceneContext } from 'scayvo';
import { App } from './App';
import './styles.css';

export async function mountApp(context: SceneContext): Promise<MountedApp> {
  if (context.signal.aborted) {
    throw new Error('Mount aborted');
  }
  const el = document.getElementById('root');
  if (!el) throw new Error('#root is missing');
  const root: Root = createRoot(el);
  flushSync(() => {
    root.render(<App context={context} />);
  });
  return {
    async dispose() {
      flushSync(() => {
        root.unmount();
      });
    },
  };
}

export async function mountNormalApp(): Promise<MountedApp> {
  return mountApp({
    sceneId: null,
    revision: 0,
    signal: new AbortController().signal,
    custom: {
      user: { id: 'demo-talal', name: 'Talal', plan: 'free' },
    },
  });
}
