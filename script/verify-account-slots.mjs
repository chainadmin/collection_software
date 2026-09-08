// UI regression check with isolated API fixtures; real API behavior is covered
// by tests/account-slots-routes.test.ts. No customer records are created.
// Run with PLAYWRIGHT_MODULE pointing at an installed playwright-core module.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.APP_TEST_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const user = { id: "browser-admin", organizationId: "browser-org", name: "Test Admin", email: "test@example.invalid", role: "admin", status: "active" };
const portfolio = { id: "browser-portfolio", organizationId: user.organizationId, clientId: "browser-client", name: "Verification Portfolio", status: "active", totalAccounts: 1, totalFaceValue: 10000 };
const client = { id: portfolio.clientId, organizationId: user.organizationId, name: "Verification Client" };
let debtor;
let contacts = [];
let references = [];
let submitted;
let rejectCreate = false;
let lastReferenceUpdate;
const requests = [];
const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, serviceWorkers: "block" });
await context.addInitScript((auth) => localStorage.setItem("debtmanager_auth", JSON.stringify(auth)), user);
await context.route("**/api/**", async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const method = request.method();
  const data = method === "GET" ? null : request.postDataJSON();
  let output = [];
  requests.push({ path, method });
  if (path === "/api/auth/session") output = { type: "collector", collector: user };
  else if (path === "/api/auth/status") output = { isAuthenticated: true };
  else if (path === "/api/collectors") output = [user];
  else if (path.startsWith("/api/time-clock/active")) output = null;
  else if (path === "/api/clients") output = [client];
  else if (path === "/api/portfolios") output = [portfolio];
  else if (path.startsWith("/api/organizations/")) output = { id: user.organizationId, name: "Verification Agency", isActive: true };
  else if (path === "/api/import/next-file-number") output = { nextFileNumber: 1 };
  else if (path === "/api/debtors" && method === "POST") {
    if (rejectCreate) return route.fulfill({ status: 400, json: { error: "Verification save failure" } });
    submitted = data;
    debtor = { ...data, id: "browser-debtor", organizationId: user.organizationId, assignedCollectorId: user.id };
    contacts = data.contacts.map((contact, index) => ({ ...contact, id: `phone-${index}`, debtorId: debtor.id, isValid: true }));
    references = data.references.map((reference, index) => ({ ...reference, id: `ref-${index}`, debtorId: debtor.id }));
    output = debtor;
  } else if (path === "/api/debtors") output = debtor ? [debtor] : [];
  else if (path === "/api/debtors/browser-debtor") {
    if (method === "PATCH") debtor = { ...debtor, ...data };
    output = debtor;
  } else if (path.endsWith("/contacts")) {
    if (method === "POST") contacts.push({ ...data, id: `phone-${contacts.length}`, isValid: true });
    output = contacts;
  } else if (path.endsWith("/references")) {
    if (method === "POST") references.push({ ...data, id: `ref-${references.length}` });
    output = references;
  } else if (path.startsWith("/api/contacts/")) {
    const id = path.split("/").pop();
    if (method === "DELETE") contacts = contacts.filter((contact) => contact.id !== id);
    else contacts = contacts.map((contact) => contact.id === id ? { ...contact, ...data } : contact);
    output = contacts.find((contact) => contact.id === id) || { success: true };
  } else if (path.startsWith("/api/references/")) {
    const id = path.split("/").pop();
    lastReferenceUpdate = data;
    if (method === "DELETE") references = references.filter((reference) => reference.id !== id);
    else references = references.map((reference) => reference.id === id ? { ...reference, ...data } : reference);
    output = references.find((reference) => reference.id === id) || { success: true };
  }
  await route.fulfill({ status: 200, json: output });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
try {
  await page.goto(`${base}/app/debtors`);
  await page.getByTestId("button-add-debtor").click();
  const dialog = page.getByRole("dialog");
  await page.getByTestId("select-portfolio").click();
  await page.getByRole("option", { name: portfolio.name }).click();
  await page.getByTestId("input-account-number").fill("UI-001");
  await page.getByTestId("input-first-name").fill("Browser");
  await page.getByTestId("input-last-name").fill("Verification");
  // Semantic labels let this check cover the visible form, not React internals.
  for (let index = 1; index <= 7; index++) {
    await dialog.getByLabel(`Phone ${index}`, { exact: true }).fill(`20255501${String(index).padStart(2, "0")}`);
  }
  await dialog.getByLabel("Reference 3 phone 2", { exact: true }).fill("2025550332");
  await page.getByTestId("button-submit-debtor").click();
  await dialog.getByText(/Reference 3 name is required/).waitFor();
  assert.equal(submitted, undefined);
  assert.equal(await dialog.getByLabel("Reference 3 phone 2", { exact: true }).inputValue(), "2025550332");
  for (let index = 1; index <= 3; index++) {
    await dialog.getByLabel(`Reference ${index} name`, { exact: true }).fill(`Relative ${index}`);
    for (let phone = 1; phone <= 3; phone++) {
      await dialog.getByLabel(`Reference ${index} phone ${phone}`, { exact: true }).fill(`202555${index}0${phone}0`);
    }
  }
  for (let index = 1; index <= 10; index++) {
    await dialog.getByLabel(`Custom field ${index} name`, { exact: true }).fill(`Attribute ${index}`);
    await dialog.getByLabel(`Custom field ${index} value`, { exact: true }).fill(`Value ${index}`);
  }
  await dialog.screenshot({ path: "/tmp/account-slots-creation.jpg" });
  rejectCreate = true;
  await page.getByTestId("button-submit-debtor").click();
  await dialog.getByText(/Verification save failure/).waitFor();
  assert.equal(await page.getByTestId("input-account-number").inputValue(), "UI-001");
  rejectCreate = false;
  await page.getByTestId("button-submit-debtor").click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(submitted.contacts.length, 7);
  assert.equal(submitted.contacts.filter((phone) => phone.isPrimary).length, 1);
  assert.equal(submitted.references.length, 3);
  assert.ok(submitted.references.every((reference) => reference.phone && reference.phone2 && reference.phone3));
  assert.equal(Object.keys(JSON.parse(submitted.customFields)).length, 10);
  await page.getByTestId("debtor-row-browser-debtor").click();
  await page.getByRole("heading", { name: "Browser Verification" }).waitFor();
  await page.getByText("Attribute 10", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit Relative 1", exact: true }).click();
  await page.locator("#reference-phone2").fill("");
  await page.getByRole("button", { name: "Save Reference", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(lastReferenceUpdate.phone2, null);
  await page.reload();
  await page.getByText("Attribute 10", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("phone-phone-6").count(), 1);
  const customRow = page.getByText("Attribute 10", { exact: true }).locator("..");
  await customRow.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Attribute 10 value", { exact: true }).fill("");
  await customRow.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByLabel("Attribute 10 value", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(JSON.parse(debtor.customFields)["Attribute 10"], "");
  await page.getByTestId("phone-phone-6").getByRole("button", { name: /^Remove/ }).click();
  await page.getByTestId("phone-phone-6").waitFor({ state: "hidden" });
  assert.equal(contacts.length, 6);
  await page.screenshot({ path: "/tmp/account-slots-detail.jpg", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/account-slots-mobile.jpg", fullPage: true });
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto(`${base}/app/workstation`);
  await page.getByTestId("queue-item-browser-debtor").click();
  await page.getByText("Employment Records", { exact: true }).click();
  await page.getByTestId("button-add-employment").click();
  assert.equal(await page.getByRole("dialog").getByTestId("input-reference-phone2").count(), 0);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("References", { exact: true }).click();
  await page.getByTestId("button-add-reference").click();
  await page.getByTestId("input-reference-name").fill("Workstation Relative");
  await page.getByTestId("input-reference-phone").fill("2025550441");
  await page.getByTestId("input-reference-phone2").fill("2025550442");
  await page.getByTestId("input-reference-phone3").fill("2025550443");
  await page.getByTestId("button-save-reference").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(references[3].phone2, "2025550442");
  assert.equal(references[3].phone3, "2025550443");
  await page.getByTestId("button-edit-reference-ref-3").click();
  await page.getByTestId("input-reference-phone2").fill("");
  await page.getByTestId("input-reference-phone3").fill("");
  await page.getByTestId("button-save-reference").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(lastReferenceUpdate.phone2, null);
  assert.equal(lastReferenceUpdate.phone3, null);
  assert.equal(references[3].phone, "2025550441");
  for (const importType of ["Debtor Accounts", "Contact Information"]) {
    await page.goto(`${base}/app/admin/tools/import-export`);
    await page.getByTestId("select-import-type").click();
    await page.getByRole("option", { name: importType, exact: true }).click();
    await page.getByTestId("select-import-client").click();
    await page.getByRole("option", { name: client.name, exact: true }).click();
    await page.getByTestId("select-import-portfolio").click();
    await page.getByRole("option", { name: portfolio.name, exact: true }).click();
    await page.getByTestId("input-import-file").setInputFiles({
      name: "expanded-fields.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Account,Seventh,Relative Third,Custom\nUI-001,2025550107,2025550333,sample"),
    });
    await page.getByTestId("button-continue-mapping").click();
    await page.getByTestId("select-mapping-Seventh").click();
    await page.getByRole("option", { name: "Phone 7", exact: true }).click();
    await page.getByTestId("select-mapping-Custom").click();
    await page.getByRole("option", { name: /Custom Field 10/ }).click();
    await page.getByTestId("select-mapping-Relative Third").click();
    await page.getByRole("option", { name: /Reference 3 Phone 3/ }).click();
    await page.screenshot({ path: `/tmp/account-slots-mapping-${importType.split(" ")[0]}.jpg` });
  }
  assert.deepEqual(errors, []);
  console.log("UI passed: seven phones, nine relative phones, ten custom values, unnamed-reference validation, save-error retention, reload, detail/workstation add/edit/clear, and expanded account/contact import mappings.");
} catch (error) {
  console.error("Browser errors:", errors);
  console.error("Visible page:", (await page.locator("body").innerText()).slice(0, 5000));
  throw error;
} finally {
  await browser.close();
}