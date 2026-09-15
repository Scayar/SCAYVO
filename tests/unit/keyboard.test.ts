/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { deckActionFromKey, shouldIgnoreKey } from '../../src/client/keyboard.js';

function key(init: KeyboardEventInit, target?: EventTarget): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true });
  if (target) Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('keyboard remote', () => {
  it('ignores typing, IME, modifiers, and key repeat', () => {
    const input = document.createElement('input');
    expect(shouldIgnoreKey(key({ key: '2' }, input))).toBe(true);
    expect(shouldIgnoreKey(key({ key: '2', isComposing: true }))).toBe(true);
    expect(shouldIgnoreKey(key({ key: '2', ctrlKey: true }))).toBe(true);
    expect(shouldIgnoreKey(key({ key: '2', repeat: true }))).toBe(true);
  });

  it('maps deck keys and leaves wrap policy to the controller', () => {
    expect(deckActionFromKey(key({ key: 'ArrowLeft' }), { remoteNumbers: true })).toEqual({ type: 'prev' });
    expect(deckActionFromKey(key({ key: 'ArrowRight' }), { remoteNumbers: true })).toEqual({ type: 'next' });
    expect(deckActionFromKey(key({ key: 'Escape' }), { remoteNumbers: false })).toEqual({ type: 'escape' });
    expect(deckActionFromKey(key({ key: '1' }), { remoteNumbers: false })).toBeNull();
  });
});
