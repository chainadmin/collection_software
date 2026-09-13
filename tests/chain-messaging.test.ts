import assert from "node:assert/strict";
import test from "node:test";
import { sendChainMessage } from "../server/chain-messaging";

test("Chain messaging uses the documented email endpoint and payload", async () => {
  const nativeFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | undefined;
  try {
    globalThis.fetch = async (input, init) => {
      request = { url: String(input), init };
      return new Response(JSON.stringify({ success: true, data: { attemptId: "attempt-1" } }), { status: 200 });
    };
    const result = await sendChainMessage(
      { apiBaseUrl: "https://chain.test", apiKey: "key" },
      { fileNumber: "1001", contactValue: "ada@example.test", channel: "email", subject: "Hello", body: "Email body" },
    );
    assert.equal(request?.url, "https://chain.test/api/v2/send_email_c2c");
    assert.equal((request?.init?.headers as Record<string, string>).Authorization, "Bearer key");
    assert.deepEqual(JSON.parse(String(request?.init?.body)), {
      fileNumber: "1001", emailAddress: "ada@example.test", subject: "Hello", body: "Email body",
    });
    assert.deepEqual(result, { success: true, externalId: "attempt-1" });
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test("Chain messaging treats a 2xx success:false response as a failure", async () => {
  const nativeFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: "Provider rejected number" }), { status: 200 });
    const result = await sendChainMessage(
      { apiBaseUrl: "https://chain.test/api/v2/", apiKey: "key" },
      { fileNumber: "1001", contactValue: "2025550101", channel: "sms", body: "Text body" },
    );
    assert.deepEqual(result, { success: false, error: "Provider rejected number" });
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

// This is the exact scenario that let DMP report "success" while Chain never
// saw the request: a misconfigured apiBaseUrl (e.g. missing /api/v2, or a
// typo) hits Chain's own web app instead of its API. Chain's SPA answers ANY
// unmatched path - including this POST - with a 200 OK HTML page, not JSON.
test("treats a 2xx HTML response (a misrouted request) as failed, not a default success", async () => {
  const nativeFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("<!doctype html><html><body>Chain</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
    const result = await sendChainMessage(
      { apiBaseUrl: "https://chain.test", apiKey: "key" },
      { fileNumber: "1001", contactValue: "2025550101", channel: "sms", body: "Text body" },
    );
    assert.equal(result.success, false);
    assert.match(result.error!, /not valid JSON/);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test("treats a 2xx response missing the success field as failed, not a default success", async () => {
  const nativeFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    const result = await sendChainMessage(
      { apiBaseUrl: "https://chain.test", apiKey: "key" },
      { fileNumber: "1001", contactValue: "ada@example.test", channel: "email", body: "Email body" },
    );
    assert.equal(result.success, false);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
