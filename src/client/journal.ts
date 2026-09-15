import { JOURNAL_KEY_PREFIX } from '../core/protocol.js';
import type { BaselineStorage, Json } from '../core/types.js';
import { ScayvoError } from '../core/errors.js';

export type JournalPhase = 'idle' | 'applying' | 'active' | 'resetting';

export type Journal = {
  v: 1;
  projectId: string;
  sessionId: string;
  configHash: string;
  phase: JournalPhase;
  sceneId: string | null;
  revision: number;
  baseline: {
    route: string;
    storage: BaselineStorage;
    adapters: Record<string, Json>;
  };
};

export function journalKey(projectId: string, sessionId: string): string {
  return `${JOURNAL_KEY_PREFIX}${projectId}:${sessionId}`;
}

export function sessionKey(projectId: string): string {
  return `scayvo:session:${projectId}`;
}

export function readOrCreateSessionId(projectId: string): string {
  const key = sessionKey(projectId);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

export function readJournal(projectId: string, sessionId: string): Journal | null {
  const raw = sessionStorage.getItem(journalKey(projectId, sessionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Journal;
    if (parsed.v !== 1 || parsed.projectId !== projectId || parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeJournal(journal: Journal): void {
  try {
    sessionStorage.setItem(journalKey(journal.projectId, journal.sessionId), JSON.stringify(journal));
  } catch (error) {
    throw new ScayvoError(
      'STORAGE_UNAVAILABLE',
      'Could not write the SCAYVO recovery journal. Free sessionStorage quota and reload.',
      { cause: error },
    );
  }
}

export function clearJournal(projectId: string, sessionId: string): void {
  sessionStorage.removeItem(journalKey(projectId, sessionId));
}
