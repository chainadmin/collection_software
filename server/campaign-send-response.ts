export interface CampaignSendOutcome {
  status: "sent" | "partial" | "failed";
  totalSent: number;
  totalFailed: number;
  errorMessage: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const BAD_URL_HINT = "check that the integration's API URL points at Chain's API, not its web app.";

/**
 * Interprets a raw response body from Chain's /campaigns/send. Chain's real
 * endpoint always returns JSON with numeric totalSent/totalFailed fields.
 * Anything else - HTML (Chain's own SPA fallback route answers any
 * unmatched path with a 200 HTML page, so a misconfigured apiBaseUrl missing
 * the /api/v2 prefix still looks like a "successful" 2xx), an empty body, a
 * proxy error page - means the request never reached Chain's campaign
 * handler at all, and must be treated as failed rather than defaulted to
 * success. An earlier version of this check assumed success whenever the
 * body didn't parse, which silently hid exactly that misconfiguration.
 */
export function interpretCampaignSendResponse(rawBody: string, totalContacts: number): CampaignSendOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return {
      status: "failed",
      totalSent: 0,
      totalFailed: totalContacts,
      errorMessage: `Chain's response was not valid JSON - ${BAD_URL_HINT}`,
    };
  }

  const totalSent = isRecord(parsed) && typeof parsed.totalSent === "number" ? parsed.totalSent : undefined;
  const totalFailed = isRecord(parsed) && typeof parsed.totalFailed === "number" ? parsed.totalFailed : undefined;
  if (totalSent === undefined || totalFailed === undefined) {
    return {
      status: "failed",
      totalSent: 0,
      totalFailed: totalContacts,
      errorMessage: `Chain's response did not include delivery counts - ${BAD_URL_HINT}`,
    };
  }

  if (totalSent === 0) {
    return {
      status: "failed",
      totalSent,
      totalFailed,
      errorMessage: `Chain reported 0 sent, ${totalFailed} failed of ${totalContacts} contacts`,
    };
  }
  if (totalFailed > 0) {
    return {
      status: "partial",
      totalSent,
      totalFailed,
      errorMessage: `Chain reported ${totalSent} sent, ${totalFailed} failed of ${totalContacts} contacts`,
    };
  }
  return { status: "sent", totalSent, totalFailed, errorMessage: null };
}
