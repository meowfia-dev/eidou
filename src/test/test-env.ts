import { mock } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// 1. Setup HappyDOM environment
try {
  GlobalRegistrator.register();
} catch (e) {
  // Ignore if already registered
}

// 2. Define shared mocks
// We export this so tests can assert on it (expect(invokeMock).toHaveBeenCalled...)
export const invokeMock = mock(() => Promise.resolve({ accepted: true }));
export const SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";
export const transformCallback = mock(() => 1);
export const addPluginListener = mock(async () => ({ unregister: async () => {} }));
export const checkPermissions = mock(async () => ({ state: "granted" }));
export const requestPermissions = mock(async () => ({ state: "granted" }));
export const convertFileSrc = mock((path: string) => path);
export const isTauri = mock(() => true);

export class Channel<T = unknown> {
  id = 1;
  onmessage: ((message: T) => void) | null;

  constructor(onmessage?: (message: T) => void) {
    this.onmessage = onmessage ?? null;
  }
}

export class PluginListener {
  async unregister() {
    return;
  }
}

export class Resource {
  rid: number;

  constructor(rid = 0) {
    this.rid = rid;
  }

  async close() {
    return;
  }
}

// 3. Register module mocks
mock.module("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  SERIALIZE_TO_IPC_FN,
  transformCallback,
  addPluginListener,
  checkPermissions,
  requestPermissions,
  convertFileSrc,
  isTauri,
  Channel,
  PluginListener,
  Resource,
}));

// 4. Helper to reset mocks between tests
export function resetTestEnv() {
  invokeMock.mockClear();
}
