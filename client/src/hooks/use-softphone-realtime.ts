import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

interface IncomingCallAnsweredMessage {
  type: "incoming-call-answered";
  fileNumber: string;
  matchCount: number;
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
  | IncomingCallAnsweredMessage
  | CallParkedMessage
  | CallUnparkedMessage
  | { type: string };

interface SoftphoneRealtimeCallbacks {
  onIncomingCallAnswered?: (fileNumber: string) => void;
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
            if (message.type === "incoming-call-answered") {
              callbacksRef.current.onIncomingCallAnswered?.((message as IncomingCallAnsweredMessage).fileNumber);
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
