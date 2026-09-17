import { useCallback, useState } from "react";
import { printReceipt, type PrinterDevice, type PrinterConnection } from "~/lib/thermal-print";
import { getReceipt, type ReceiptFormat } from "~/lib/api";
import { useToast } from "./useToast";

interface ThermalPrintState {
  printing: boolean;
  lastConnection: PrinterConnection | null;
  lastError: string | null;
  availableDevices: PrinterDevice[];
}

export function useThermalPrint() {
  const { push } = useToast();
  const [state, setState] = useState<ThermalPrintState>({
    printing: false,
    lastConnection: null,
    lastError: null,
    availableDevices: [],
  });

  const printOrder = useCallback(
    async (
      orderId: string,
      options: { format?: ReceiptFormat; copies?: number; cutPaper?: boolean; preferredConnection?: PrinterConnection } = {},
    ): Promise<boolean> => {
      setState((s) => ({ ...s, printing: true, lastError: null }));
      try {
        // Fetch ESC/POS receipt from API
        const receiptBuffer = await getReceipt(orderId, { format: options.format ?? 'escpos' });

        const escposData = new Uint8Array(receiptBuffer);
        const result = await printReceipt(escposData, {
          copies: options.copies,
          cutPaper: options.cutPaper,
          preferredConnection: options.preferredConnection,
        });

        setState((s) => ({
          ...s,
          printing: false,
          lastConnection: result.connection,
          lastError: result.error ?? null,
        }));

        if (result.success) {
          push("success", `Receipt printed via ${result.connection}`);
          return true;
        } else {
          push("error", result.error ?? "Print failed");
          return false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Print failed";
        setState((s) => ({ ...s, printing: false, lastError: message }));
        push("error", message);
        return false;
      }
    },
    [push],
  );

  const printRaw = useCallback(
    async (
      escposData: Uint8Array,
      options: { copies?: number; cutPaper?: boolean; preferredConnection?: PrinterConnection } = {},
    ): Promise<boolean> => {
      setState((s) => ({ ...s, printing: true, lastError: null }));
      try {
        const result = await printReceipt(escposData, options);
        setState((s) => ({
          ...s,
          printing: false,
          lastConnection: result.connection,
          lastError: result.error ?? null,
        }));

        if (result.success) {
          push("success", `Printed via ${result.connection}`);
          return true;
        } else {
          push("error", result.error ?? "Print failed");
          return false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Print failed";
        setState((s) => ({ ...s, printing: false, lastError: message }));
        push("error", message);
        return false;
      }
    },
    [push],
  );

  return {
    ...state,
    printOrder,
    printRaw,
  };
}