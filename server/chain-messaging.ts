export type ChainMessage = {
  fileNumber: string;
  contactValue: string;
  channel: "email" | "sms";
  subject?: string;
  body: string;
  externalId?: string;
};

export type ChainMessageResult = {
  success: boolean;
  externalId?: string;
  error?: string;
};

function chainApiUrl(baseUrl: string, endpoint: "send_text" | "send_email_c2c"): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (/\/api\/v2$/i.test(base)) return `${base}/${endpoint}`;
  if (/\/api$/i.test(base)) return `${base}/v2/${endpoint}`;
  return `${base}/api/v2/${endpoint}`;
}

function responseError(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const body = value as Record<string, unknown>;
  for (const key of ["error", "message", "details"]) {
    if (typeof body[key] === "string" && body[key]) return body[key] as string;
  }
  return undefined;
}

/** Send one message using Chain's documented External API contract. */
export async function sendChainMessage(
  integration: { apiBaseUrl: string; apiKey: string },
  message: ChainMessage,
): Promise<ChainMessageResult> {
  const isEmail = message.channel === "email";
  const payload = isEmail
    ? {
        fileNumber: message.fileNumber,
        emailAddress: message.contactValue,
        subject: message.subject || "",
        body: message.body,
        externalId: message.externalId,
      }
    : {
        fileNumber: message.fileNumber,
        phoneNumber: message.contactValue,
        message: message.body,
        externalId: message.externalId,
      };

  const response = await fetch(chainApiUrl(integration.apiBaseUrl, isEmail ? "send_email_c2c" : "send_text"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result: any;
  try { result = text ? JSON.parse(text) : undefined; } catch { result = undefined; }
  if (!response.ok || result?.success === false) {
    return { success: false, error: responseError(result) || text || `Chain returned HTTP ${response.status}` };
  }
  return {
    success: true,
    externalId: result?.data?.attemptId || result?.data?.externalId || result?.externalId,
  };
}
