import type { BaselineStorage, BaselineStorageValue } from '../core/types.js';
import { ScayvoError } from '../core/errors.js';

export type StorageAreas = {
  local: Storage;
  session: Storage;
};

export type ManagedKeys = {
  local: string[];
  session: string[];
};

const FOREIGN_PREFIX = 'scayvo:foreign:';

export function captureBaselineStorage(managed: ManagedKeys, areas: StorageAreas): BaselineStorage {
  return {
    local: captureArea(areas.local, managed.local),
    session: captureArea(areas.session, managed.session),
  };
}

function captureArea(storage: Storage, keys: string[]): Record<string, BaselineStorageValue> {
  const out: Record<string, BaselineStorageValue> = {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(storage, key) && storage.getItem(key) === null) {
      out[key] = { kind: 'absent' };
    } else {
      const value = storage.getItem(key);
      if (value === null) out[key] = { kind: 'absent' };
      else out[key] = { kind: 'value', value };
    }
  }
  return out;
}

export function restoreBaselineStorage(
  baseline: BaselineStorage,
  managed: ManagedKeys,
  areas: StorageAreas,
): void {
  restoreArea(areas.local, managed.local, baseline.local);
  restoreArea(areas.session, managed.session, baseline.session);
}

function restoreArea(
  storage: Storage,
  keys: string[],
  baseline: Record<string, BaselineStorageValue>,
): void {
  for (const key of keys) {
    const entry = baseline[key] ?? { kind: 'absent' as const };
    if (entry.kind === 'absent') storage.removeItem(key);
    else storage.setItem(key, entry.value);
  }
}

export function applyStoragePatch(
  patch: { local: Record<string, string | null>; session: Record<string, string | null> },
  baseline: BaselineStorage,
  managed: ManagedKeys,
  areas: StorageAreas,
): void {
  applyArea(areas.local, managed.local, patch.local, baseline.local);
  applyArea(areas.session, managed.session, patch.session, baseline.session);
}

function applyArea(
  storage: Storage,
  keys: string[],
  patch: Record<string, string | null>,
  baseline: Record<string, BaselineStorageValue>,
): void {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const value = patch[key];
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } else {
      const entry = baseline[key] ?? { kind: 'absent' as const };
      if (entry.kind === 'absent') storage.removeItem(key);
      else storage.setItem(key, entry.value);
    }
  }
}

export function createForeignStorageGuard(managed: ManagedKeys): {
  hasConflict(area: 'local' | 'session', key: string): boolean;
  conflicts(): string[];
  dispose(): void;
} {
  const flagged = new Set<string>();
  const onStorage = (event: StorageEvent) => {
    if (!event.key) return;
    const area = event.storageArea === localStorage ? 'local' : event.storageArea === sessionStorage ? 'session' : null;
    if (!area) return;
    if (!managed[area].includes(event.key)) return;
    flagged.add(`${area}:${event.key}`);
  };
  window.addEventListener('storage', onStorage);
  return {
    hasConflict(area, key) {
      return flagged.has(`${area}:${key}`);
    },
    conflicts() {
      return [...flagged];
    },
    dispose() {
      window.removeEventListener('storage', onStorage);
    },
  };
}

export function assertNoStorageConflict(guard: { conflicts(): string[] }): void {
  const conflicts = guard.conflicts();
  if (conflicts.length === 0) return;
  throw new ScayvoError(
    'STORAGE_CONFLICT',
    `Managed storage changed in another tab: ${conflicts.join(', ')}`,
  );
}

export function probeStorage(areas: StorageAreas): void {
  const probe = `${FOREIGN_PREFIX}probe`;
  try {
    areas.session.setItem(probe, '1');
    areas.session.removeItem(probe);
    areas.local.setItem(probe, '1');
    areas.local.removeItem(probe);
  } catch (error) {
    throw new ScayvoError('STORAGE_UNAVAILABLE', 'Browser storage is not available for SCAYVO.', {
      cause: error,
    });
  }
}
