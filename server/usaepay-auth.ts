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
  // The PIN is a signing secret, not the Basic-auth password. USAePay's apihash
  // is "s2/<seed>/<sha256 hex of sourceKey+seed+pin>" -- the "s2/" tag identifies
  // the hash algorithm and is required, not optional. The Basic value is then
  // sourceKey:apihash (two colon-joined fields, not three) base64-encoded.
  const hash = createHash("sha256").update(`${normalizedSourceKey}${seed}${normalizedPin}`, "utf8").digest("hex");
  const apiHash = `s2/${seed}/${hash}`;
  return `Basic ${Buffer.from(`${normalizedSourceKey}:${apiHash}`, "utf8").toString("base64")}`;
}
