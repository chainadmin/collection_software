import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { randomUUID } from "crypto";

// Collectors authenticate the WebSocket connection with a short-lived token
// minted from their existing collector session (see the
// /api/collector/realtime-token route), rather than re-verifying the
// session cookie during the raw HTTP upgrade - simpler and lower-risk than
// parsing/unsigning express-session's cookie outside its own middleware.
interface PendingToken {
  collectorId: string;
  organizationId: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 30_000;
const pendingTokens = new Map<string, PendingToken>();

// A collector may have more than one tab/window open, so each collectorId
// maps to a set of live sockets rather than a single one.
const collectorSockets = new Map<string, Set<WebSocket>>();

export function mintRealtimeToken(collectorId: string, organizationId: string): string {
  const token = randomUUID();
  pendingTokens.set(token, { collectorId, organizationId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function consumeRealtimeToken(token: string): PendingToken | null {
  const entry = pendingTokens.get(token);
  if (!entry) return null;
  // One-time use: a token is only ever good for the single connection it
  // was minted for.
  pendingTokens.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

export function initRealtimeSoftphone(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/softphone" });

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const token = url.searchParams.get("token") || "";
    const identity = consumeRealtimeToken(token);

    if (!identity) {
      ws.close(4001, "Invalid or expired token");
      return;
    }

    let sockets = collectorSockets.get(identity.collectorId);
    if (!sockets) {
      sockets = new Set();
      collectorSockets.set(identity.collectorId, sockets);
    }
    sockets.add(ws);

    ws.on("close", () => {
      const current = collectorSockets.get(identity.collectorId);
      if (!current) return;
      current.delete(ws);
      if (current.size === 0) {
        collectorSockets.delete(identity.collectorId);
      }
    });

    ws.on("error", () => {
      // The 'close' event still fires after 'error', so cleanup happens
      // above - this handler just stops an unhandled 'error' event from
      // crashing the process.
    });

    ws.send(JSON.stringify({ type: "connected" }));
  });

  // Tokens that were minted but never used to open a connection (the tab
  // was closed before the WebSocket connected, a network hiccup, etc.)
  // would otherwise sit in the map forever.
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of Array.from(pendingTokens.entries())) {
      if (entry.expiresAt < now) {
        pendingTokens.delete(token);
      }
    }
  }, 60_000);
  sweepInterval.unref();
}

/** Returns true if at least one live connection for this collector received the message. */
export function pushToCollector(collectorId: string, message: unknown): boolean {
  const sockets = collectorSockets.get(collectorId);
  if (!sockets || sockets.size === 0) return false;

  const payload = JSON.stringify(message);
  let sent = false;
  for (const ws of Array.from(sockets)) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      sent = true;
    }
  }
  return sent;
}
