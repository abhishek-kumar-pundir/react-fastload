import { getConnectionInfo, subscribeToConnectionChange } from "../utils/connection";
import type { ConnectionInfo } from "../core/types";

export type NetworkCallback = (info: ConnectionInfo) => void;

/**
 * Thin observer wrapper around the Network Information API, kept separate
 * from utils/connection.ts (which does the actual reading) so the
 * LoadManager and tests can depend on an observer interface rather than
 * a global-scope subscription directly.
 */
export class NetworkObserver {
  private unsubscribe?: () => void;
  private listeners = new Set<NetworkCallback>();

  constructor() {
    this.unsubscribe = subscribeToConnectionChange((info) => {
      for (const listener of this.listeners) listener(info);
    });
  }

  getSnapshot(): ConnectionInfo {
    return getConnectionInfo();
  }

  subscribe(callback: NetworkCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  disconnect(): void {
    this.unsubscribe?.();
    this.listeners.clear();
  }
}
