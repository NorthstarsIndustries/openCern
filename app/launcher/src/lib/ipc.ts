/**
 * IPC bridge — wraps Electron's contextBridge API to match the
 * Tauri invoke/listen signatures so hooks need minimal changes.
 */

declare global {
  interface Window {
    electronAPI: {
      invoke: <T>(channel: string, args?: unknown) => Promise<T>;
      on: <T>(channel: string, callback: (data: T) => void) => () => void;
    };
  }
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return window.electronAPI.invoke<T>(command, args);
}

export async function listen<T>(
  event: string,
  handler: (event: { payload: T }) => void,
): Promise<() => void> {
  const unsub = window.electronAPI.on<T>(event, (data) => {
    handler({ payload: data });
  });
  return unsub;
}
