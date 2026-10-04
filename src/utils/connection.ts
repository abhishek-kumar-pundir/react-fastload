import { isBrowser, supportsNetworkInformation } from "./browserSupport";
import type { ConnectionInfo } from "../core/types";

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

function getConnectionApi(): NetworkInformationLike | undefined {
  if (!isBrowser) return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

/**
 * Reads the current network conditions using the Network Information API
 * where supported. Never invents values: unsupported fields are `null`,
 * and callers must treat that as "unknown", not "fast".
 */
export function getConnectionInfo(): ConnectionInfo {
  const conn = getConnectionApi();
  const supported = supportsNetworkInformation() && !!conn;

  if (!supported || !conn) {
    return {
      effectiveType: null,
      downlink: null,
      rtt: null,
      saveData: false,
      supported: false,
    };
  }

  return {
    effectiveType: conn.effectiveType ?? null,
    downlink: typeof conn.downlink === "number" ? conn.downlink : null,
    rtt: typeof conn.rtt === "number" ? conn.rtt : null,
    saveData: conn.saveData ?? false,
    supported: true,
  };
}

/** Subscribes to connection changes; no-ops (returns a noop unsubscribe) when unsupported/SSR. */
export function subscribeToConnectionChange(
  onChange: (info: ConnectionInfo) => void
): () => void {
  const conn = getConnectionApi();
  if (!conn || typeof conn.addEventListener !== "function") {
    return () => {};
  }

  const handler = () => onChange(getConnectionInfo());
  conn.addEventListener("change", handler);
  return () => conn.removeEventListener?.("change", handler);
}
