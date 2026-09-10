import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const secret = process.env.PAYMENT_CARD_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("PAYMENT_CARD_ENCRYPTION_KEY must be configured to store card numbers");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypt a PAN at rest using authenticated AES-256-GCM encryption. */
export function encryptCardNumber(cardNumber: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(cardNumber, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** Decrypt a PAN only for an authenticated, tenant-checked card response. */
export function decryptCardNumber(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted card number");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
