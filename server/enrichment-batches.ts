import crypto from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { debtorAddresses, debtorContacts, debtorReferences, debtors, enrichmentAuditLog, enrichmentBatchMembers, enrichmentBatchResults, enrichmentBatches } from "@shared/schema";

export type EnrichmentRow = { internalAccountId?: string; fileNumber?: string; accountNumber?: string; phones?: Array<string | { value: string; label?: string }>; emails?: string[]; people?: Array<{ name: string; relationship?: string; phone?: string; email?: string }>; addresses?: Array<{ address: string; city?: string; state?: string; zipCode?: string }> };
const normPhone = (v: string) => { const d = v.replace(/\D/g, ""); return d.length === 11 && d[0] === "1" ? d.slice(1) : d; };
const norm = (v?: string | null) => (v || "").trim().toLowerCase().replace(/\s+/g, " ");
const hash = (v: unknown) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");

export async function createEnrichmentBatch(org: string, actor: string, input: { name: string; sourceType: string; sourceReference?: string; accountIds?: string[] }) {
  const allowed = ["MANUAL_SELECTION", "FILE_GROUP", "PORTFOLIO", "FILTERED_SET", "OTHER"];
  if (!allowed.includes(input.sourceType)) throw new Error("Invalid source type");
  return db.transaction(async tx => {
    const [batch] = await tx.insert(enrichmentBatches).values({ organizationId: org, createdBy: actor, name: input.name, sourceType: input.sourceType, sourceReference: input.sourceReference }).returning();
    let selected;
    if (input.sourceType === "PORTFOLIO") selected = await tx.select().from(debtors).where(and(eq(debtors.organizationId, org), eq(debtors.portfolioId, input.sourceReference!)));
    else if (input.sourceType === "FILE_GROUP") selected = await tx.select().from(debtors).where(and(eq(debtors.organizationId, org), eq(debtors.fileNumber, input.sourceReference!)));
    else selected = input.accountIds?.length ? await tx.select().from(debtors).where(and(eq(debtors.organizationId, org), inArray(debtors.id, input.accountIds))) : [];
    if (!selected.length) throw new Error("No accounts in this organization matched the selection");
    await tx.insert(enrichmentBatchMembers).values(selected.map(d => ({ batchId: batch.id, organizationId: org, debtorId: d.id, existingFileNumber: d.fileNumber, existingAccountNumber: d.accountNumber })));
    const [saved] = await tx.update(enrichmentBatches).set({ accountCount: selected.length }).where(eq(enrichmentBatches.id, batch.id)).returning();
    return { ...saved, missingStableIdentifiers: selected.filter(d => !d.id || (!d.fileNumber && !d.accountNumber)).map(d => d.id) };
  });
}

export async function exportBatch(org: string, id: string) {
  const [batch] = await db.select().from(enrichmentBatches).where(and(eq(enrichmentBatches.id, id), eq(enrichmentBatches.organizationId, org)));
  if (!batch) throw new Error("Batch not found");
  const members = await db.select({ internalAccountId: debtors.id, fileNumber: debtors.fileNumber, accountNumber: debtors.accountNumber }).from(enrichmentBatchMembers).innerJoin(debtors, and(eq(debtors.id, enrichmentBatchMembers.debtorId), eq(debtors.organizationId, org))).where(and(eq(enrichmentBatchMembers.batchId, id), eq(enrichmentBatchMembers.organizationId, org)));
  await db.update(enrichmentBatches).set({ status: "EXPORTED", exportedAt: new Date() }).where(and(eq(enrichmentBatches.id, id), eq(enrichmentBatches.organizationId, org)));
  return members;
}

export async function previewReturn(org: string, actor: string, batchId: string, rows: EnrichmentRow[], fileHash?: string) {
  const [batch] = await db.select().from(enrichmentBatches).where(and(eq(enrichmentBatches.id, batchId), eq(enrichmentBatches.organizationId, org)));
  if (!batch) throw new Error("Batch not found");
  const digest = fileHash || hash(rows);
  if (batch.returnFileHash === digest && ["RETURNED", "PROCESSING", "COMPLETED", "COMPLETED_WITH_REVIEW"].includes(batch.status)) throw new Error("This batch result appears to have already been processed.");
  const members = await db.select({ debtor: debtors }).from(enrichmentBatchMembers).innerJoin(debtors, and(eq(debtors.id, enrichmentBatchMembers.debtorId), eq(debtors.organizationId, org))).where(and(eq(enrichmentBatchMembers.batchId, batchId), eq(enrichmentBatchMembers.organizationId, org)));
  const staged = rows.map((row, i) => {
    const byId = row.internalAccountId ? members.filter(x => x.debtor.id === row.internalAccountId) : [];
    const byFile = row.fileNumber ? members.filter(x => x.debtor.fileNumber === row.fileNumber) : [];
    const byAccount = row.accountNumber ? members.filter(x => x.debtor.accountNumber === row.accountNumber) : [];
    const candidates = byId.length ? byId : byFile.length ? byFile : byAccount;
    const conflict = [byId, byFile, byAccount].filter(x => x.length).some(x => candidates[0] && x[0].debtor.id !== candidates[0].debtor.id);
    const matched = candidates.length === 1 && !conflict ? candidates[0].debtor : undefined;
    return { batchId, organizationId: org, rowNumber: i + 1, rowHash: hash(row), debtorId: matched?.id, matchMethod: byId.length ? "INTERNAL_ID" : byFile.length ? "FILE_NUMBER" : byAccount.length ? "ACCOUNT_NUMBER" : undefined, status: matched ? "MATCHED" : "MATCH_REVIEW_REQUIRED", inputData: JSON.stringify(row), previewData: JSON.stringify({ phones: row.phones?.length || 0, emails: row.emails?.length || 0, people: row.people?.length || 0, addresses: row.addresses?.length || 0 }), processedBy: actor };
  });
  await db.transaction(async tx => { await tx.delete(enrichmentBatchResults).where(and(eq(enrichmentBatchResults.batchId, batchId), eq(enrichmentBatchResults.organizationId, org), eq(enrichmentBatchResults.status, "MATCHED"))); if (staged.length) await tx.insert(enrichmentBatchResults).values(staged).onConflictDoNothing(); await tx.update(enrichmentBatches).set({ status: "RETURNED", returnedAt: new Date(), returnFileHash: digest }).where(and(eq(enrichmentBatches.id, batchId), eq(enrichmentBatches.organizationId, org))); });
  return { totalReturnedRows: rows.length, matchedAccounts: staged.filter(x => x.status === "MATCHED").length, unmatchedRows: staged.filter(x => x.status !== "MATCHED").length, newPhoneNumbers: rows.reduce((n, x) => n + (x.phones?.length || 0), 0), newPeople: rows.reduce((n, x) => n + (x.people?.length || 0), 0), newAddresses: rows.reduce((n, x) => n + (x.addresses?.length || 0), 0), newEmails: rows.reduce((n, x) => n + (x.emails?.length || 0), 0) };
}

export async function applyReturn(org: string, actor: string, batchId: string) {
  const results = await db.select().from(enrichmentBatchResults).where(and(eq(enrichmentBatchResults.batchId, batchId), eq(enrichmentBatchResults.organizationId, org), eq(enrichmentBatchResults.status, "MATCHED")));
  let applied = 0, failed = 0;
  for (const result of results) try {
    await db.transaction(async tx => {
      const row: EnrichmentRow = JSON.parse(result.inputData); const debtorId = result.debtorId!;
      const existingContacts = await tx.select().from(debtorContacts).where(and(eq(debtorContacts.organizationId, org), eq(debtorContacts.debtorId, debtorId)));
      for (const p of row.phones || []) { const value = typeof p === "string" ? p : p.value; const normalized = normPhone(value); if (!normalized) continue; const prior = existingContacts.find(c => c.type === "phone" && normPhone(c.value) === normalized); if (!prior) { await tx.insert(debtorContacts).values({ organizationId: org, debtorId, type: "phone", value: normalized, label: typeof p === "string" ? null : p.label }); await tx.insert(enrichmentAuditLog).values({ organizationId: org, batchId, debtorId, resultId: result.id, actorId: actor, action: "ADD", field: "phone", newValue: normalized, matchMethod: result.matchMethod }); } }
      for (const email of row.emails || []) if (!existingContacts.some(c => c.type === "email" && norm(c.value) === norm(email))) { await tx.insert(debtorContacts).values({ organizationId: org, debtorId, type: "email", value: norm(email) }); await tx.insert(enrichmentAuditLog).values({ organizationId: org, batchId, debtorId, resultId: result.id, actorId: actor, action: "ADD", field: "email", newValue: norm(email), matchMethod: result.matchMethod }); }
      const refs = await tx.select().from(debtorReferences).where(and(eq(debtorReferences.organizationId, org), eq(debtorReferences.debtorId, debtorId)));
      for (const person of row.people || []) if (!refs.some(r => norm(r.name) === norm(person.name) && norm(r.relationship) === norm(person.relationship) && normPhone(r.phone || "") === normPhone(person.phone || ""))) { await tx.insert(debtorReferences).values({ organizationId: org, debtorId, name: person.name, relationship: person.relationship, phone: person.phone ? normPhone(person.phone) : null, notes: person.email ? `Email: ${norm(person.email)}` : null, addedDate: new Date().toISOString() }); await tx.insert(enrichmentAuditLog).values({ organizationId: org, batchId, debtorId, resultId: result.id, actorId: actor, action: "ADD", field: "related_person", newValue: JSON.stringify(person), matchMethod: result.matchMethod }); }
      const addresses = await tx.select().from(debtorAddresses).where(and(eq(debtorAddresses.organizationId, org), eq(debtorAddresses.debtorId, debtorId)));
      for (const a of row.addresses || []) if (!addresses.some(x => norm(`${x.address}|${x.city}|${x.state}|${x.zipCode}`) === norm(`${a.address}|${a.city}|${a.state}|${a.zipCode}`))) { await tx.insert(debtorAddresses).values({ ...a, organizationId: org, debtorId, source: "batch", sourceBatchId: batchId }); await tx.insert(enrichmentAuditLog).values({ organizationId: org, batchId, debtorId, resultId: result.id, actorId: actor, action: "ADD", field: "address", newValue: JSON.stringify(a), matchMethod: result.matchMethod }); }
      await tx.update(enrichmentBatchResults).set({ status: "PROCESSED", processedBy: actor, processedAt: new Date() }).where(and(eq(enrichmentBatchResults.id, result.id), eq(enrichmentBatchResults.organizationId, org)));
    }); applied++;
  } catch { failed++; await db.update(enrichmentBatchResults).set({ status: "FAILED", error: "Row transaction failed" }).where(and(eq(enrichmentBatchResults.id, result.id), eq(enrichmentBatchResults.organizationId, org))); }
  const review = await db.select({ count: sql<number>`count(*)` }).from(enrichmentBatchResults).where(and(eq(enrichmentBatchResults.batchId, batchId), eq(enrichmentBatchResults.organizationId, org), eq(enrichmentBatchResults.status, "MATCH_REVIEW_REQUIRED")));
  await db.update(enrichmentBatches).set({ status: failed || Number(review[0].count) ? "COMPLETED_WITH_REVIEW" : "COMPLETED", processedAt: new Date() }).where(and(eq(enrichmentBatches.id, batchId), eq(enrichmentBatches.organizationId, org)));
  return { applied, failed, reviewRequired: Number(review[0].count) };
}
