import assert from "node:assert/strict";
import test from "node:test";
import { interpretCampaignSendResponse } from "../server/campaign-send-response";

test("reports full success when Chain sent everything", () => {
  const outcome = interpretCampaignSendResponse(
    JSON.stringify({ campaignLogId: "c1", totalSent: 3, totalFailed: 0, totalSkipped: 0 }),
    3,
  );
  assert.deepEqual(outcome, { status: "sent", totalSent: 3, totalFailed: 0, errorMessage: null });
});

test("reports partial when some contacts failed", () => {
  const outcome = interpretCampaignSendResponse(
    JSON.stringify({ totalSent: 2, totalFailed: 1 }),
    3,
  );
  assert.equal(outcome.status, "partial");
  assert.equal(outcome.totalSent, 2);
  assert.equal(outcome.totalFailed, 1);
});

test("reports failed when nothing was actually sent, even on a 2xx", () => {
  const outcome = interpretCampaignSendResponse(
    JSON.stringify({ totalSent: 0, totalFailed: 3 }),
    3,
  );
  assert.equal(outcome.status, "failed");
});

// This is the exact scenario that let DMP report "success" while Chain never
// saw the request: a misconfigured apiBaseUrl (missing the /api/v2 prefix)
// hits Chain's own SPA catch-all route, which answers ANY unmatched path -
// including POST - with a 200 OK HTML page, not JSON.
test("treats a 2xx HTML response as failed, not as a default success", () => {
  const html = "<!doctype html><html><body>Chain</body></html>";
  const outcome = interpretCampaignSendResponse(html, 5);
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.totalSent, 0);
  assert.equal(outcome.totalFailed, 5);
  assert.match(outcome.errorMessage!, /not valid JSON/);
});

test("treats valid JSON missing delivery counts as failed, not as a default success", () => {
  const outcome = interpretCampaignSendResponse(JSON.stringify({ ok: true }), 2);
  assert.equal(outcome.status, "failed");
  assert.match(outcome.errorMessage!, /did not include delivery counts/);
});

test("treats an empty body as failed", () => {
  const outcome = interpretCampaignSendResponse("", 1);
  assert.equal(outcome.status, "failed");
});
