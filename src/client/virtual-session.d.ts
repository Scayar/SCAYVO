declare module 'virtual:scayvo/session' {
  import type { SessionPayload } from './engine.js';
  export const session: SessionPayload;
  const payload: SessionPayload;
  export default payload;
}
