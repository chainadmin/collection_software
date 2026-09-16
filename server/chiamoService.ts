// Calls back into Chiamo (chain-admin) to trigger pickup of a call parked
// there. The connection details (chiamoApiUrl/chiamoApiKey) are configured
// per-organization in Settings - chiamoApiKey is the "Chain API Key" Chain
// admin generates on its side (tenantSettings.externalApiKey), presented
// here as a bearer token.

export type ChiamoPickupResult = {
  success: boolean;
  error?: string;
};

function chiamoPickupUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return `${base}/api/v2/parked_call_pickup`;
}

/** Ask Chain to reconnect a parked call to the collector identified by chiamoEmail. */
export async function pickupParkedCall(
  connection: { chiamoApiUrl: string; chiamoApiKey: string },
  args: { parkedCallId: string; chiamoEmail: string },
): Promise<ChiamoPickupResult> {
  try {
    const response = await fetch(chiamoPickupUrl(connection.chiamoApiUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.chiamoApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parkedCallId: args.parkedCallId,
        chiamoEmail: args.chiamoEmail,
      }),
    });

    const text = await response.text();
    let result: any;
    try { result = text ? JSON.parse(text) : undefined; } catch { result = undefined; }

    if (!response.ok || typeof result?.success !== "boolean") {
      return { success: false, error: result?.error || text || `Chain returned HTTP ${response.status}` };
    }
    if (!result.success) {
      return { success: false, error: result?.error || "Chain reported the pickup could not be completed" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to reach Chain" };
  }
}
