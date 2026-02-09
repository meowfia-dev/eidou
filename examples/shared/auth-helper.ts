import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const AUTH_ENV_VAR = "EIDOU_AUTH_SECRET";

function linuxRuntimeTokenPath(): string | null {
  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (!runtimeDir) {
    return null;
  }
  return join(runtimeDir, "eidou", "auth-token");
}

function platformCacheTokenPath(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Caches", "eidou", "auth-token");
  }

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return join(localAppData, "eidou", "auth-token");
    }
    return join(homedir(), "AppData", "Local", "eidou", "auth-token");
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  if (xdgCacheHome) {
    return join(xdgCacheHome, "eidou", "auth-token");
  }

  return join(homedir(), ".cache", "eidou", "auth-token");
}

function legacyTokenPath(): string | null {
  if (process.platform !== "win32") {
    return null;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    return join(localAppData, "eidou", "cache", "auth-token");
  }

  return join(homedir(), "AppData", "Local", "eidou", "cache", "auth-token");
}

function tokenFromFile(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }

  const token = readFileSync(path, "utf8").trim();
  if (token.length === 0) {
    throw new Error(`Auth token file is empty: ${path}`);
  }

  return token;
}

export function discoverAuthToken(): string {
  const fromEnv = process.env[AUTH_ENV_VAR]?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const checkedPaths: string[] = [];

  if (process.platform === "linux") {
    const runtimePath = linuxRuntimeTokenPath();
    if (runtimePath) {
      checkedPaths.push(runtimePath);
      const runtimeToken = tokenFromFile(runtimePath);
      if (runtimeToken) {
        return runtimeToken;
      }
    }
  }

  const cachePath = platformCacheTokenPath();
  checkedPaths.push(cachePath);
  const cacheToken = tokenFromFile(cachePath);
  if (cacheToken) {
    return cacheToken;
  }

  const oldPath = legacyTokenPath();
  if (oldPath) {
    checkedPaths.push(oldPath);
    const oldToken = tokenFromFile(oldPath);
    if (oldToken) {
      return oldToken;
    }
  }

  throw new Error(
    [
      "No Eidou auth token found.",
      `${AUTH_ENV_VAR} takes precedence when set.`,
      `If Eidou started with ${AUTH_ENV_VAR}, set the same variable for this client because auth-token may not be written.`,
      `Otherwise ensure auth-token exists at one of:`,
      ...checkedPaths.map((path) => `- ${path}`),
    ].join("\n")
  );
}

export function withAuthToken(baseUrl: URL): URL {
  const tokenizedUrl = new URL(baseUrl.toString());
  tokenizedUrl.searchParams.set("token", discoverAuthToken());
  return tokenizedUrl;
}
