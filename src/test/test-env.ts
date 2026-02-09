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

// 3. Register module mocks
mock.module("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

// 4. Helper to reset mocks between tests
export function resetTestEnv() {
  invokeMock.mockClear();
}
