// Minimal fetch wrapper for POS-API. No axios — zero extra deps.
// - Base URL from VITE_API_URL (fallback: same-origin /api via Vite proxy)
// - Bearer token from localStorage, refresh-on-401 once
// - Throws ApiError with status + code for UI to handle

const ACCESS_KEY = "pos.accessToken";
const REFRESH_KEY = "pos.refreshToken";

export function getApiBase(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  const url = env["VITE_API_URL"] ?? "";
  if (url.length > 0) return url.replace(/\/$/, "");
  return "";
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string | null, refresh: string | null): void {
  try {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    else localStorage.removeItem(ACCESS_KEY);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    // storage unavailable (SSR) — ignore
  }
}

export function clearTokens(): void {
  setTokens(null, null);
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  retry?: boolean;
}

let refreshInflight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async (): Promise<boolean> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, headers = {}, auth = true, retry = true } = opts;
  const url = `${getApiBase()}${path}`;

  const finalHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_OFFLINE", "Cannot reach the server. Check connection or use demo mode.");
  }

  if (res.status === 401 && auth && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...opts, retry: false });
    clearTokens();
    throw new ApiError(401, "UNAUTHENTICATED", "Session expired. Please sign in again.");
  }

  if (res.status === 204) return undefined as unknown as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const obj = (data ?? {}) as { message?: string; code?: string; error?: string };
    throw new ApiError(
      res.status,
      obj.code ?? obj.error ?? `HTTP_${res.status}`,
      obj.message ?? `Request failed (${res.status})`,
      data,
    );
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "PUT", body, headers }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "PATCH", body, headers }),
  del: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "DELETE", headers }),
};
