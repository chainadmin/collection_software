import { createHash, randomBytes } from "node:crypto";

/** Build the signed, per-request HTTP authorization value required by REST v2. */
export function usaepayAuthorization(
  sourceKey: string,
  pin: string,
  seed = randomBytes(16).toString("hex"),
): string {
  // Normalize at request time too so merchants saved before input
  // normalization was added do not keep generating invalid signatures.
  const normalizedSourceKey = sourceKey.trim();
  const normalizedPin = pin.trim();
  // The PIN is a signing secret, not the Basic-auth password. USAePay expects
  // sourceKey:seed:sha256(sourceKey + seed + pin), encoded as the Basic value.
  const hash = createHash("sha256").update(`${normalizedSourceKey}${seed}${normalizedPin}`, "utf8").digest("hex");
  return `Basic ${Buffer.from(`${normalizedSourceKey}:${seed}:${hash}`, "utf8").toString("base64")}`;
}
