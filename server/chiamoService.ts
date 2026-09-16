// Calls back into Chiamo (chain-admin) to trigger actions there - picking
// up a parked call, or click-to-dial. The connection details
// (chiamoApiUrl/chiamoApiKey) are configured per-organization in Settings -
// chiamoApiKey is the "Chain API Key" Chain admin generates on its side
// (tenantSettings.externalApiKey), presented here as a bearer token.

export type ChiamoActionResult = {
  success: boolean;
  error?: string;
};

async function callChiamo(
  connection: { chiamoApiUrl: string; chiamoApiKey: string },
  endpoint: string,
  body: Record<string, unknown>,
): Promise<ChiamoActionResult> {
  try {
    const base = connection.chiamoApiUrl.trim().replace(/\/+$/, "");
    const response = await fetch(`${base}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.chiamoApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let result: any;
    try { result = text ? JSON.parse(text) : undefined; } catch { result = undefined; }

    if (!response.ok || typeof result?.success !== "boolean") {
      return { success: false, error: result?.error || text || `Chain returned HTTP ${response.status}` };
    }
    if (!result.success) {
      return { success: false, error: result?.error || "Chain reported the request could not be completed" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to reach Chain" };
  }
}

/** Ask Chain to reconnect a parked call to the collector identified by chiamoEmail. */
export async function pickupParkedCall(
  connection: { chiamoApiUrl: string; chiamoApiKey: string },
  args: { parkedCallId: string; chiamoEmail: string },
): Promise<ChiamoActionResult> {
  return callChiamo(connection, "/api/v2/parked_call_pickup", {
    parkedCallId: args.parkedCallId,
    chiamoEmail: args.chiamoEmail,
  });
}

/** Ask Chain to place an outbound call from the collector identified by chiamoEmail. */
export async function triggerClickToDial(
  connection: { chiamoApiUrl: string; chiamoApiKey: string },
  args: { chiamoEmail: string; phoneNumber: string; fileNumber?: string },
): Promise<ChiamoActionResult> {
  return callChiamo(connection, "/api/v2/click_to_dial", {
    chiamoEmail: args.chiamoEmail,
    phoneNumber: args.phoneNumber,
    fileNumber: args.fileNumber,
  });
}

export type CallControlAction = "answer" | "decline" | "hangup" | "mute" | "unmute" | "hold" | "resume";

/** Ask Chain to answer/decline/hang up/mute/hold the call in progress for the collector identified by chiamoEmail. */
export async function triggerCallControl(
  connection: { chiamoApiUrl: string; chiamoApiKey: string },
  args: { chiamoEmail: string; action: CallControlAction; connectionId?: string },
): Promise<ChiamoActionResult> {
  return callChiamo(connection, "/api/v2/call_control", {
    chiamoEmail: args.chiamoEmail,
    action: args.action,
    // Identifies which of the collector's open Chiamo tabs the call is on,
    // so Chain can target that one tab rather than every tab this
    // collector has open. Omitted (rather than sent as undefined-in-JSON)
    // when DMP never got one - the arg is optional for exactly that case.
    connectionId: args.connectionId,
  });
}
