import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface CallStateMessage {
  type: "call-state";
  status: "ringing" | "connected" | "held" | "muted" | "unmuted" | "ended" | "missed";
  direction: "inbound" | "outbound";
  phoneNumber: string;
  callerName?: string;
  fileNumber?: string;
  // Identifies which of the collector's open Chiamo tabs this call is on -
  // pass it back on any call-control command so Chain can target that one
  // tab instead of broadcasting to every tab this collector has open.
  connectionId?: string;
}

interface CallParkedMessage {
  type: "call-parked";
  parkedCallId: string;
  callerName: string;
  callerNumber: string;
}

interface CallUnparkedMessage {
  type: "call-unparked";
  parkedCallId: string;
}

type SoftphoneRealtimeMessage =
  | CallStateMessage
  | CallParkedMessage
  | CallUnparkedMessage
  | { type: string };

interface SoftphoneRealtimeCallbacks {
  onCallStateChanged?: (state: Omit<CallStateMessage, "type">) => void;
  onCallParked?: (call: { parkedCallId: string; callerName: string; callerNumber: string }) => void;
  onCallUnparked?: (parkedCallId: string) => void;
}

/**
 * Opens the softphone WebSocket connection for a logged-in collector and
 * dispatches to the given callbacks when Chiamo reports a call event.
 * Reconnects on drop (network blip, server restart) with a short fixed
 * backoff - this is a convenience channel, not a critical one, so a simple
 * retry is enough.
 */
export function useSoftphoneRealtime(
  collectorId: string | undefined,
  callbacks: SoftphoneRealtimeCallbacks,
) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!collectorId) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;
      try {
        const res = await apiRequest("GET", "/api/collector/realtime-token");
        const { token } = await res.json();
        if (cancelled || !token) return;

        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        socket = new WebSocket(`${wsProtocol}//${window.location.host}/ws/softphone?token=${encodeURIComponent(token)}`);

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as SoftphoneRealtimeMessage;
            if (message.type === "call-state") {
              const { type: _type, ...state } = message as CallStateMessage;
              callbacksRef.current.onCallStateChanged?.(state);
            } else if (message.type === "call-parked") {
              const parked = message as CallParkedMessage;
              callbacksRef.current.onCallParked?.({
                parkedCallId: parked.parkedCallId,
                callerName: parked.callerName,
                callerNumber: parked.callerNumber,
              });
            } else if (message.type === "call-unparked") {
              callbacksRef.current.onCallUnparked?.((message as CallUnparkedMessage).parkedCallId);
            }
          } catch {
            // Ignore malformed messages rather than crash the connection.
          }
        };


        socket.onclose = () => {
          if (cancelled) return;
          reconnectTimer = window.setTimeout(connect, 5000);
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch {
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [collectorId]);
}
