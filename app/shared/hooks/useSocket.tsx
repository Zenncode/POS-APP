import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";
import { getApiBase, getAccessToken } from "~/lib/httpClient";

interface SocketEvents {
  "order:created": { id: string; orderNumber: string; totalCents: number; itemCount: number };
  "order:voided": { id: string; orderNumber: string; voidedBy: string; authorizedBy: string | null };
  "order:refunded": { id: string; orderNumber: string; refundAmountCents: number; refundedBy: string; authorizedBy: string | null; lines: unknown[] };
  "stock:low": { productId: string; productName: string; currentStock: number; threshold: number };
  "socket:welcome": { id: string; connectedAt: string; user: { id: string; role: string } | null };
  "pong": { message: string; timestamp: string; payload: unknown };
  "session:revoked": void;
}

type EventKey = keyof SocketEvents;
type EventHandler<K extends EventKey> = (data: SocketEvents[K]) => void;

interface UseSocketOptions {
  autoConnect?: boolean;
  storeId?: string;
  onOrderCreated?: EventHandler<"order:created">;
  onOrderVoided?: EventHandler<"order:voided">;
  onOrderRefunded?: EventHandler<"order:refunded">;
  onStockLow?: EventHandler<"stock:low">;
  onSessionRevoked?: () => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { user, demoMode } = useAuth();
  const {
    autoConnect = true,
    storeId,
    onOrderCreated,
    onOrderVoided,
    onOrderRefunded,
    onStockLow,
    onSessionRevoked,
  } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const storeIdRef = useRef(storeId);
  const handlersRef = useRef({ onOrderCreated, onOrderVoided, onOrderRefunded, onStockLow, onSessionRevoked });

  // Keep handlers current without recreating socket
  useEffect(() => {
    handlersRef.current = { onOrderCreated, onOrderVoided, onOrderRefunded, onStockLow, onSessionRevoked };
  }, [onOrderCreated, onOrderVoided, onOrderRefunded, onStockLow, onSessionRevoked]);

  useEffect(() => {
    storeIdRef.current = storeId;
  }, [storeId]);

  const connect = useCallback(() => {
    if (demoMode || socketRef.current?.connected) return;
    if (!user) return;

    const accessToken = getAccessToken();
    if (!accessToken || accessToken === "demo.access") return;

    setConnecting(true);
    setError(null);

    const socketUrl = getApiBase().replace("/api", "").replace(/\/+$/, "");
    const socketPath = "/socket.io"; // matches POS-API SOCKET_PATH default

    const socket = io(socketUrl, {
      path: socketPath,
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      setConnected(true);
      setConnecting(false);
      setError(null);

      // Join store room for order/stock events
      const room = storeIdRef.current ? `store:${storeIdRef.current}` : "store:default";
      socket.emit("join:store", room);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      setConnecting(false);
      if (reason !== "io client disconnect") {
        setError(`Disconnected: ${reason}`);
      }
    });

    socket.on("connect_error", (err) => {
      setConnecting(false);
      setError(err.message);
    });

    socket.on("socket:welcome", (data) => {
      console.log("[Socket] Welcome:", data);
    });

    socket.on("order:created", (data) => {
      console.log("[Socket] Order created:", data);
      handlersRef.current.onOrderCreated?.(data);
    });

    socket.on("order:voided", (data) => {
      console.log("[Socket] Order voided:", data);
      handlersRef.current.onOrderVoided?.(data);
    });

    socket.on("order:refunded", (data) => {
      console.log("[Socket] Order refunded:", data);
      handlersRef.current.onOrderRefunded?.(data);
    });

    socket.on("stock:low", (data) => {
      console.log("[Socket] Stock low:", data);
      handlersRef.current.onStockLow?.(data);
    });

    socket.on("session:revoked", () => {
      console.log("[Socket] Session revoked");
      handlersRef.current.onSessionRevoked?.();
    });

    socketRef.current = socket;
  }, [demoMode, user]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnecting(false);
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit("join:room", room);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit("leave:room", room);
  }, []);

  const ping = useCallback((): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      socketRef.current?.emit("ping", { t: Date.now() }, (response: unknown) => {
        if (response && typeof response === "object" && "message" in response && response.message === "pong") {
          resolve(response);
        } else {
          reject(new Error("Ping timeout"));
        }
      });
      // Timeout after 5s
      setTimeout(() => reject(new Error("Ping timeout")), 5000);
    });
  }, []);

  // Auto-connect on user/login changes
  useEffect(() => {
    if (autoConnect && user && !demoMode) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [autoConnect, user, demoMode, connect, disconnect]);

  const value = useMemo(
    () => ({
      connected,
      connecting,
      error,
      connect,
      disconnect,
      joinRoom,
      leaveRoom,
      ping,
    }),
    [connected, connecting, error, connect, disconnect, joinRoom, leaveRoom, ping],
  );

  return value;
}