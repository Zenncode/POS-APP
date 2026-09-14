// Realtime badges — subscribes to socketClient events (`order:created`,
// `order:voided`, `stock:low`) and exposes badge counts for the shell.
// Progressive enhancement: no socket = counts stay 0, UI unchanged.
import { useEffect, useState } from "react";
import { onEvent, startRealtime } from "~/lib/socketClient";

export interface LiveBadges {
  ordersDelta: number;
  lowStockPulse: number;
  lastEvent: string | null;
  ackOrders: () => void;
  ackLowStock: () => void;
}

export function useLiveBadges(): LiveBadges {
  const [ordersDelta, setOrdersDelta] = useState(0);
  const [lowStockPulse, setLowStockPulse] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  useEffect(() => {
    startRealtime();
    const offCreated = onEvent("order:created", () => {
      setOrdersDelta((c) => Math.min(99, c + 1));
      setLastEvent("order:created");
    });
    const offVoided = onEvent("order:voided", () => {
      setOrdersDelta((c) => Math.min(99, c + 1));
      setLastEvent("order:voided");
    });
    const offLow = onEvent("stock:low", () => {
      setLowStockPulse((c) => Math.min(99, c + 1));
      setLastEvent("stock:low");
    });
    return () => {
      offCreated();
      offVoided();
      offLow();
    };
  }, []);

  return {
    ordersDelta,
    lowStockPulse,
    lastEvent,
    ackOrders: () => setOrdersDelta(0),
    ackLowStock: () => setLowStockPulse(0),
  };
}
