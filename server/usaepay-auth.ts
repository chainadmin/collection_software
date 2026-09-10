import { createHash, randomBytes } from "node:crypto";

/** Build the signed, per-request HTTP authorization value required by REST v2. */
export function usaepayAuthorization(
  sourceKey: string,
  pin: string,
  seed = randomBytes(16).toString("hex"),
): string {
  // The PIN is a signing secret, not the Basic-auth password. USAePay expects
  // sourceKey:seed:sha256(sourceKey + seed + pin), encoded as the Basic value.
  const hash = createHash("sha256").update(`${sourceKey}${seed}${pin}`, "utf8").digest("hex");
  return `Basic ${Buffer.from(`${sourceKey}:${seed}:${hash}`, "utf8").toString("base64")}`;
}
