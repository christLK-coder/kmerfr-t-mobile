// Service WebSocket STOMP — temps réel chat + position GPS
// Compatible Expo Go : utilise une implémentation pure JS

import { API_BASE_URL, WS_RECONNECT_DELAY_MS, WS_MAX_RECONNECTS } from '../utils/constants';

type MessageHandler = (body: unknown) => void;

interface Subscription {
  destination: string;
  handler: MessageHandler;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private connected = false;
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private jwtToken: string | null = null;
  private pendingMessages: string[] = [];

  connect(jwtToken: string): Promise<void> {
    this.jwtToken = jwtToken;
    return new Promise((resolve, reject) => {
      const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectCount = 0;
        this.sendFrame('CONNECT', { Authorization: `Bearer ${jwtToken}`, 'heart-beat': '10000,10000' });
        // Flush pending
        this.pendingMessages.forEach(m => this.ws?.send(m));
        this.pendingMessages = [];
        resolve();
      };

      this.ws.onmessage = (evt) => this.handleFrame(evt.data);

      this.ws.onclose = () => {
        this.connected = false;
        if (this.reconnectCount < WS_MAX_RECONNECTS) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectCount++;
            if (this.jwtToken) this.connect(this.jwtToken).catch(() => {});
          }, WS_RECONNECT_DELAY_MS);
        }
      };

      this.ws.onerror = (e) => { reject(e); };
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.sendFrame('DISCONNECT', {});
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.subscriptions.clear();
    this.jwtToken = null;
  }

  subscribe(destination: string, handler: MessageHandler): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.subscriptions.set(id, { destination, handler });
    this.sendFrame('SUBSCRIBE', { id, destination });
    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
    this.sendFrame('UNSUBSCRIBE', { id });
  }

  send(destination: string, body: unknown, headers: Record<string, string> = {}): void {
    const bodyStr = JSON.stringify(body);
    this.sendFrame('SEND', { destination, 'content-type': 'application/json', ...headers }, bodyStr);
  }

  get isConnected(): boolean { return this.connected; }

  // ─── STOMP frame encoding ────────────────────────────────────────────────

  private sendFrame(command: string, headers: Record<string, string>, body = ''): void {
    const headerStr = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n');
    const frame = `${command}\n${headerStr}\n\n${body}\0`;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else {
      this.pendingMessages.push(frame);
    }
  }

  private handleFrame(raw: string): void {
    const nullIdx = raw.indexOf('\0');
    const content = nullIdx >= 0 ? raw.substring(0, nullIdx) : raw;
    const lines = content.split('\n');
    const command = lines[0]?.trim();

    if (command === 'MESSAGE') {
      let destination = '';
      let bodyStart = 0;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].startsWith('destination:')) destination = lines[i].slice('destination:'.length).trim();
        if (lines[i] === '') { bodyStart = i + 1; break; }
      }
      const body = lines.slice(bodyStart).join('\n');
      this.subscriptions.forEach(sub => {
        if (sub.destination === destination) {
          try { sub.handler(JSON.parse(body)); } catch { sub.handler(body); }
        }
      });
    }
  }
}

export default new WebSocketService();
