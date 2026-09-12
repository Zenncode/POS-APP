// Realtime stub — Socket.IO is optional. If socket.io-client is installed
// we connect with JWT handshake auth; otherwise we degrade to polling.
// Never blocks the UI.
import { getAccessToken } from "./httpClient";

type Handler = (payload: unknown) => void;

const handlers = new Map<string, Set<Handler>>();
let started = false;

export function onEvent(name: string, fn: Handler): () => void {
  let set = handlers.get(name);
  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }
  set.add(fn);
  return () => set.delete(fn);
}

function emit(name: string, payload: unknown): void {
  handlers.get(name)?.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      // ignore listener errors
    }
  });
}

export function startRealtime(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  // Best-effort: try dynamic Socket.IO, fall back silently to no-op.
  // The app polls lists anyway, so realtime is progressive enhancement.
  void (async () => {
    try {
      // Concatenated specifier so TS doesn't try to resolve the optional dep.
      const specifier = "socket" + ".io-client";
      const mod = (await import(/* @vite-ignore */ specifier).catch(() => null)) as unknown as {
        io?: (url: string, opts: unknown) => { on: (e: string, f: (d: unknown) => void) => void; emit: (e: string, d?: unknown) => void };
      } | null;
      const token = getAccessToken();
      if (!mod?.io || !token) return;
      const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
      const url = env["VITE_API_URL"] ?? window.location.origin;
      const socket = mod.io(url, { auth: { token } });
      socket.emit("join:store", {});
      for (const ev of ["order:created", "order:voided", "stock:low", "report:daily:completed"]) {
        socket.on(ev, (d: unknown) => emit(ev, d));
      }
    } catch {
      // offline — ignore
    }
  })();
}
