export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function shouldIgnoreKey(event: KeyboardEvent): boolean {
  if (event.repeat) return true;
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  if (event.isComposing || event.key === 'Process') return true;
  if (isEditableTarget(event.target)) return true;
  return false;
}

export type DeckAction =
  | { type: 'scene-index'; index: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'replay' }
  | { type: 'reset' }
  | { type: 'film' }
  | { type: 'escape' };

export function deckActionFromKey(event: KeyboardEvent, options: { remoteNumbers: boolean }): DeckAction | null {
  if (shouldIgnoreKey(event)) return null;
  const key = event.key;
  if (key === 'Escape') return { type: 'escape' };
  if (key === 'd' || key === 'D') return { type: 'film' };
  if (key === 'r' || key === 'R') return { type: 'reset' };
  if (key === ' ' || key === 'Spacebar') return { type: 'replay' };
  if (options.remoteNumbers) {
    if (key === 'ArrowRight') return { type: 'next' };
    if (key === 'ArrowLeft') return { type: 'prev' };
    if (/^[1-9]$/.test(key)) return { type: 'scene-index', index: Number(key) - 1 };
  }
  return null;
}
