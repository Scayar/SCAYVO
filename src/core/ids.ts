import { SCENE_ID_PATTERN } from './types.js';

export function isSceneId(value: string): boolean {
  return SCENE_ID_PATTERN.test(value);
}

export function hotkeyForIndex(index: number): string | null {
  if (index < 0 || index > 8) return null;
  return String(index + 1);
}

export function sceneIndexFromHotkey(key: string, orderLength: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const index = Number(key) - 1;
  if (index >= orderLength) return null;
  return index;
}
