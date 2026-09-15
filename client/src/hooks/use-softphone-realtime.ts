import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

interface IncomingCallAnsweredMessage {
  type: "incoming-call-answered";
  fileNumber: string;
  matchCount: number;
}

/**
 * Opens the softphone WebSocket connection for a logged-in collector and
 * calls onIncomingCallAnswered when Chiamo reports a call was answered and
 * resolves to this collector's account. Reconnects on drop (network blip,
 * server restart) with a short fixed backoff - this is a convenience
 * channel, not a critical one, so a simple retry is enough.
 */
export function useSoftphoneRealtime(
  collectorId: string | undefined,
  onIncomingCallAnswered: (fileNumber: string) => void,
) {
  const onIncomingCallAnsweredRef = useRef(onIncomingCallAnswered);
  onIncomingCallAnsweredRef.current = onIncomingCallAnswered;

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
            const message = JSON.parse(event.data) as IncomingCallAnsweredMessage | { type: string };
            if (message.type === "incoming-call-answered") {
              onIncomingCallAnsweredRef.current((message as IncomingCallAnsweredMessage).fileNumber);
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
