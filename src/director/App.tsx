import { useEffect, useMemo, useRef, useState } from 'react';
import { deckActionFromKey } from '../client/keyboard';

type SceneInfo = { id: string; title: string; hotkey: string | null; route?: string };

type Bootstrap = {
  protocol: 1;
  projectId: string;
  token: string;
  wsPath: string;
  configHash: string | null;
  scenes: {
    initialScene: string;
    order: string[];
    hash: string;
    scenes: SceneInfo[];
  } | null;
};

type Connection =
  | 'waiting'
  | 'connected'
  | 'applying'
  | 'active'
  | 'reconnecting'
  | 'failed'
  | 'recovery-failed';

type DirectorState = {
  connection: Connection;
  sceneId: string | null;
  route: string;
  remoteMode: boolean;
  hideDemoBadge: boolean;
  unhandled: Array<{ id: string; method: string; path: string }>;
  diagnostic?: { code: string; message: string; fix?: string };
  configHash: string;
  recovery?: boolean;
};

declare global {
  interface Window {
    __SCAYVO_DIRECTOR__?: Bootstrap;
  }
}

const LABELS: Record<Connection, string> = {
  waiting: 'Waiting for app',
  connected: 'Connected',
  applying: 'Applying',
  active: 'Active',
  reconnecting: 'Reconnecting',
  failed: 'Failed',
  'recovery-failed': 'Recovery failed',
};

export function App() {
  const boot = window.__SCAYVO_DIRECTOR__;
  const [film, setFilm] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [remoteDraft, setRemoteDraft] = useState(false);
  const [hideBadgeDraft, setHideBadgeDraft] = useState(false);
  const [state, setState] = useState<DirectorState>({
    connection: 'waiting',
    sceneId: boot?.scenes?.initialScene ?? null,
    route: '/',
    remoteMode: false,
    hideDemoBadge: false,
    unhandled: [],
    configHash: boot?.configHash ?? '',
  });
  const [progress, setProgress] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const scenes = boot?.scenes?.scenes ?? [];
  const order = useMemo(() => scenes.map((s) => s.id), [scenes]);
  const currentIndex = state.sceneId ? order.indexOf(state.sceneId) : -1;
  const current = scenes[currentIndex] ?? scenes[0];

  const sendCommand = (type: 'SCENE_APPLY' | 'RESET', sceneId?: string) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (state.connection === 'applying') return;
    setProgress(true);
    ws.send(
      JSON.stringify({
        protocol: 1,
        projectId: boot?.projectId,
        clientId: 'director',
        requestId: crypto.randomUUID(),
        configHash: boot?.configHash,
        type,
        sceneId,
      }),
    );
  };

  const sendControl = (action: 'remote' | 'badge', value: boolean) => {
    socketRef.current?.send(JSON.stringify({ protocol: 1, type: 'CONTROL', action, value }));
  };

  useEffect(() => {
    if (!boot) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}${boot.wsPath}`);
    socketRef.current = ws;
    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          protocol: 1,
          type: 'AUTH',
          token: boot.token,
          role: 'director',
          clientId: `director-${crypto.randomUUID()}`,
          projectId: boot.projectId,
        }),
      );
    });
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (message.type === 'AUTH_FAILED') {
        setState((prev) => ({ ...prev, connection: 'failed', diagnostic: { code: 'UNAUTHORIZED', message: String(message.message ?? 'Auth failed') } }));
        return;
      }
      if (message.type === 'STATE') {
        const next = message as unknown as DirectorState & { type: string };
        setState({
          connection: next.connection,
          sceneId: next.sceneId,
          route: next.route,
          remoteMode: next.remoteMode,
          hideDemoBadge: next.hideDemoBadge,
          unhandled: next.unhandled ?? [],
          diagnostic: next.diagnostic,
          configHash: next.configHash,
          recovery: next.recovery,
        });
        setProgress(next.connection === 'applying');
      }
      if (message.type === 'SCENE_APPLIED' || message.type === 'RESET_COMPLETED' || message.type === 'COMMAND_FAILED') {
        setProgress(false);
        if (message.type === 'COMMAND_FAILED') {
          const error = message.error as { code: string; message: string; fix?: string } | undefined;
          setState((prev) => ({
            ...prev,
            diagnostic: error,
            connection: error?.code === 'BUSY' ? prev.connection : prev.connection,
          }));
          setDiagOpen(true);
        }
      }
      if (message.type === 'CONFIG_CHANGED') {
        setState((prev) => ({
          ...prev,
          diagnostic: {
            code: 'CONFIG_CHANGED',
            message: 'Configuration changed. Reset and reload the app.',
          },
        }));
        setDiagOpen(true);
      }
    });
    ws.addEventListener('close', () => {
      setState((prev) => ({
        ...prev,
        connection: prev.connection === 'failed' ? 'failed' : 'reconnecting',
      }));
    });
    return () => ws.close();
  }, [boot]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = deckActionFromKey(event, { remoteNumbers: true });
      if (!action) return;
      event.preventDefault();
      if (action.type === 'film') {
        setFilm((v) => !v);
        return;
      }
      if (action.type === 'replay' && state.sceneId) sendCommand('SCENE_APPLY', state.sceneId);
      if (action.type === 'reset') sendCommand('RESET');
      if (action.type === 'next' && currentIndex >= 0 && currentIndex < order.length - 1) {
        sendCommand('SCENE_APPLY', order[currentIndex + 1]);
      }
      if (action.type === 'prev' && currentIndex > 0) {
        sendCommand('SCENE_APPLY', order[currentIndex - 1]);
      }
      if (action.type === 'scene-index' && order[action.index]) {
        sendCommand('SCENE_APPLY', order[action.index]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.sceneId, currentIndex, order]);

  if (!boot) {
    return (
      <main className="shell boot-missing">
        <span className="mark" aria-hidden="true" />
        <p className="brand">Scayvo</p>
        <h1>Director</h1>
        <p>Director bootstrap is missing. Restart `scayvo dev` on localhost.</p>
      </main>
    );
  }

  const lamp = (
    <span className={`lamp ${state.connection}`} data-connection={state.connection}>
      <i />
      {LABELS[state.connection]}
    </span>
  );

  if (film) {
    return (
      <main className="film" data-mode="film">
        <span className="film-giant" aria-hidden="true">
          {current?.hotkey ?? '–'}
        </span>
        <header className="film-top">
          {lamp}
          <button className="text-btn" onClick={() => setFilm(false)}>
            Exit film
          </button>
        </header>
        <p className="film-kicker">{current?.hotkey ? `Scene ${current.hotkey}` : 'Scene'}</p>
        <h1 className="film-title">{current?.title ?? 'No scene'}</h1>
        {current?.id ? <p className="film-id">{current.id}</p> : null}
        <div className="film-actions">
          <button disabled={currentIndex <= 0} onClick={() => sendCommand('SCENE_APPLY', order[currentIndex - 1])}>
            Previous
          </button>
          <button
            disabled={currentIndex < 0 || currentIndex >= order.length - 1}
            onClick={() => sendCommand('SCENE_APPLY', order[currentIndex + 1])}
          >
            Next
          </button>
          <button className="accent" disabled={!state.sceneId} onClick={() => state.sceneId && sendCommand('SCENE_APPLY', state.sceneId)}>
            Replay
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="mast">
        <div className="mast-brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <p className="brand">Scayvo</p>
            <h1>{boot.projectId}</h1>
          </div>
        </div>
        <div className="meta">
          {lamp}
          <span className="route" data-route={state.route}>
            {state.route || '/'}
          </span>
        </div>
      </header>

      <p className="sheet-kicker">Cue sheet</p>
      <ol className="scenes">
        {scenes.map((scene, index) => {
          const active = scene.id === state.sceneId && state.connection === 'active';
          return (
            <li key={scene.id}>
              <button
                className={active ? 'scene active' : 'scene'}
                data-scene-id={scene.id}
                data-active={active ? 'true' : 'false'}
                onClick={() => sendCommand('SCENE_APPLY', scene.id)}
              >
                <span className="num">{scene.hotkey ?? String(index + 1)}</span>
                <span className="scene-body">
                  <strong>{scene.title}</strong>
                  <em>{scene.id}</em>
                </span>
                {active ? <span className="live">LIVE</span> : null}
              </button>
            </li>
          );
        })}
      </ol>

      {progress ? (
        <div className="progress" data-progress="true">
          <span />
          Applying scene
        </div>
      ) : null}

      <footer className="deck">
        <div className="actions">
          <button disabled={currentIndex <= 0} data-action="prev" onClick={() => sendCommand('SCENE_APPLY', order[currentIndex - 1])}>
            Previous
          </button>
          <button
            disabled={currentIndex < 0 || currentIndex >= order.length - 1}
            data-action="next"
            onClick={() => sendCommand('SCENE_APPLY', order[currentIndex + 1])}
          >
            Next
          </button>
          <button className="accent" data-action="replay" disabled={!state.sceneId} onClick={() => state.sceneId && sendCommand('SCENE_APPLY', state.sceneId)}>
            Replay
          </button>
          <button data-action="reset" onClick={() => sendCommand('RESET')}>
            Reset
          </button>
        </div>

        <section className="toggles">
          <label>
            <input
              type="checkbox"
              checked={remoteDraft}
              onChange={(e) => {
                setRemoteDraft(e.target.checked);
                sendControl('remote', e.target.checked);
              }}
            />
            Remote mode in app
          </label>
          <label>
            <input
              type="checkbox"
              checked={hideBadgeDraft}
              onChange={(e) => {
                setHideBadgeDraft(e.target.checked);
                sendControl('badge', e.target.checked);
              }}
            />
            Hide DEMO MODE badge
          </label>
          <button className="text-btn" onClick={() => setFilm(true)}>
            Film mode (D)
          </button>
        </section>

        <section className="diag">
          <button className="text-btn" onClick={() => setDiagOpen((v) => !v)}>
            {diagOpen ? 'Hide diagnostics' : 'Diagnostics'}
          </button>
          {diagOpen ? (
            <div className="diag-panel" data-diagnostics="open">
              {state.diagnostic ? (
                <p>
                  <strong>{state.diagnostic.code}</strong> {state.diagnostic.message}
                  {state.diagnostic.fix ? <span className="fix">{state.diagnostic.fix}</span> : null}
                </p>
              ) : (
                <p>No engine error. Unhandled in-scope requests appear below.</p>
              )}
              {state.unhandled.length === 0 ? (
                <p className="muted">No blocked requests this session.</p>
              ) : (
                <ul>
                  {state.unhandled.map((item) => (
                    <li key={item.id}>
                      {item.method} {item.path}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        <p className="keys">1–9 scenes · ← → · space replay · R reset · D film</p>
        <p className="tagline">Your next demo. One key away.</p>
      </footer>
    </main>
  );
}
