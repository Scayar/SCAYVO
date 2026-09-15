import type { ErrorCode } from './types.js';

export class ScayvoError extends Error {
  readonly code: ErrorCode;
  readonly path?: string;
  readonly fix: string;

  constructor(code: ErrorCode, message: string, options?: { path?: string; fix?: string; cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'ScayvoError';
    this.code = code;
    this.path = options?.path;
    this.fix = options?.fix ?? defaultFix(code);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      path: this.path,
      fix: this.fix,
    };
  }
}

export function defaultFix(code: ErrorCode): string {
  switch (code) {
    case 'CONFIG_INVALID':
      return 'Run `npx scayvo validate` and fix the reported config path.';
    case 'FIXTURE_NOT_FOUND':
      return 'Create the fixture file relative to scayvo.config.ts, or correct the path.';
    case 'FIXTURE_INVALID_JSON':
      return 'Ensure the fixture is valid JSON with no comments or trailing commas.';
    case 'FIXTURE_OUTSIDE_ROOT':
      return 'Keep fixtures inside the project root. Relative paths only.';
    case 'FIXTURE_TOO_LARGE':
      return 'Reduce fixture size below 1 MiB and the resolved config below 5 MiB.';
    case 'NO_CLIENT':
      return 'Open the React app tab so SCAYVO can handshake, then retry the command.';
    case 'PROTOCOL_MISMATCH':
      return 'Restart the Vite dev server and reload the app so both sides use protocol 1.';
    case 'ADAPTER_MISSING':
      return 'Register the adapter in src/scayvo.dev.ts before applying this scene.';
    case 'WORKER_CONFLICT':
      return 'Stop the other Service Worker for this origin, or use a clean profile. SCAYVO will not unregister workers it does not own.';
    case 'UNHANDLED_REQUEST':
      return 'Add a mock for this method and path, or move the request outside network.scope.';
    case 'STORAGE_UNAVAILABLE':
      return 'Allow sessionStorage/localStorage for this origin, or free quota, then reload.';
    case 'STORAGE_CONFLICT':
      return 'Use a single app tab. Another tab changed a managed storage key.';
    case 'TRANSITION_TIMEOUT':
      return 'Check adapters and mount() for work that ignores AbortSignal. Then Reset.';
    case 'RECOVERY_FAILED':
      return 'Reload the app. SCAYVO will restore managed inputs before applying a scene.';
    case 'BUSY':
      return 'Wait for the current scene transition to finish, then send one command.';
    case 'SCENE_NOT_FOUND':
      return 'Use an id from config.order. Run `npx scayvo list`.';
    case 'ALREADY_CONNECTED':
      return 'Close the extra app tab. v0.1 supports one app client.';
    case 'UNAUTHORIZED':
      return 'Use the Director URL printed by the current `scayvo dev` process.';
    case 'CONFIG_CHANGED':
      return 'Reset, then reload the app to start a new session with the updated config.';
    case 'LOOPBACK_REQUIRED':
      return 'Bind the Vite server to localhost. Control endpoints stay disabled on 0.0.0.0.';
    default:
      return 'See the SCAYVO README for the reported error code.';
  }
}

export function adapterMissingMessage(adapterName: string, sceneId: string): string {
  return `Scene ${sceneId} could not start. Adapter ${adapterName} is missing. Register it in src/scayvo.dev.ts.`;
}
