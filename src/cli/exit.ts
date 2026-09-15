export const EXIT = {
  ok: 0,
  exec: 1,
  config: 2,
  noClient: 3,
  busy: 4,
} as const;

export function fail(message: string, code: number): never {
  console.error(message);
  process.exit(code);
}
