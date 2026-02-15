import type { WSEvent } from "./types";

type EventCallback = (event: WSEvent) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: Set<EventCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;

  constructor(url?: string) {
    const wsProtocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = typeof window !== "undefined" ? window.location.host : "localhost:8080";
    const base = url || `${wsProtocol}//${wsHost}/ws`;

    // Append auth token as query param (WebSocket doesn't support custom headers in browsers)
    const token = typeof window !== "undefined" ? localStorage.getItem("velero_token") : null;
    if (token && token !== "none") {
      this.url = `${base}?token=${encodeURIComponent(token)}`;
    } else {
      this.url = base;
    }
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectDelay = 2000;
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          this.callbacks.forEach((cb) => cb(data));
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  subscribe(callback: EventCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }
}
