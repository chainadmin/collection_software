import net from "node:net";

export type ParsedIpEntry = {
  canonical: string;
  address: string;
  prefixLength: number;
  family: 4 | 6;
  bytes: Uint8Array;
};

function parseIpv4(value: string): Uint8Array | null {
  if (net.isIP(value) !== 4) return null;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return Uint8Array.from(parts);
}

function parseIpv6(value: string): Uint8Array | null {
  if (net.isIP(value) !== 6 || value.includes("%")) return null;

  let expanded = value.toLowerCase();
  const ipv4Match = expanded.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[1]);
    if (!ipv4) return null;
    const replacement = `${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
    expanded = expanded.slice(0, -ipv4Match[1].length) + replacement;
  }

  const halves = expanded.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const words = [...left, ...Array(missing).fill("0"), ...right].map((part) => Number.parseInt(part, 16));
  if (words.length !== 8 || words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)) {
    return null;
  }

  const bytes = new Uint8Array(16);
  words.forEach((word, index) => {
    bytes[index * 2] = word >>> 8;
    bytes[index * 2 + 1] = word & 0xff;
  });
  return bytes;
}

function isIpv4Mapped(bytes: Uint8Array): boolean {
  return bytes.length === 16 &&
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff && bytes[11] === 0xff;
}

function formatIpv4(bytes: Uint8Array): string {
  return Array.from(bytes).join(".");
}

function formatIpv6(bytes: Uint8Array): string {
  const words = Array.from({ length: 8 }, (_, index) => (bytes[index * 2] << 8) | bytes[index * 2 + 1]);
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < words.length;) {
    if (words[index] !== 0) {
      index++;
      continue;
    }
    let end = index;
    while (end < words.length && words[end] === 0) end++;
    if (end - index > bestLength && end - index >= 2) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end;
  }
  if (bestStart < 0) return words.map((word) => word.toString(16)).join(":");
  const before = words.slice(0, bestStart).map((word) => word.toString(16)).join(":");
  const after = words.slice(bestStart + bestLength).map((word) => word.toString(16)).join(":");
  return `${before}::${after}`;
}

function maskAddress(bytes: Uint8Array, prefixLength: number): Uint8Array {
  const result = Uint8Array.from(bytes);
  for (let bit = prefixLength; bit < result.length * 8; bit++) {
    result[Math.floor(bit / 8)] &= ~(1 << (7 - (bit % 8)));
  }
  return result;
}

export function parseIpAddress(value: unknown): Omit<ParsedIpEntry, "prefixLength" | "canonical"> | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input || input.includes("/") || input.includes("%")) return null;
  const ipv4 = parseIpv4(input);
  if (ipv4) return { address: formatIpv4(ipv4), family: 4, bytes: ipv4 };
  const ipv6 = parseIpv6(input);
  if (!ipv6) return null;
  if (isIpv4Mapped(ipv6)) {
    const mapped = ipv6.slice(12);
    return { address: formatIpv4(mapped), family: 4, bytes: mapped };
  }
  return { address: formatIpv6(ipv6), family: 6, bytes: ipv6 };
}

export function parseIpEntry(value: unknown): ParsedIpEntry | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  const slash = input.indexOf("/");
  if (slash !== input.lastIndexOf("/")) return null;
  const addressInput = slash < 0 ? input : input.slice(0, slash);
  const parsed = parseIpAddress(addressInput);
  if (!parsed) return null;

  let prefixLength = parsed.family === 4 ? 32 : 128;
  if (slash >= 0) {
    const prefixText = input.slice(slash + 1);
    if (!/^(0|[1-9]\d*)$/.test(prefixText)) return null;
    prefixLength = Number(prefixText);
    const originalFamily = net.isIP(addressInput);
    if (originalFamily === 6 && parsed.family === 4) {
      if (prefixLength < 96 || prefixLength > 128) return null;
      prefixLength -= 96;
    }
    const max = parsed.family === 4 ? 32 : 128;
    if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > max) return null;
  }

  const network = maskAddress(parsed.bytes, prefixLength);
  const address = parsed.family === 4 ? formatIpv4(network) : formatIpv6(network);
  const canonical = slash < 0 ? parsed.address : `${address}/${prefixLength}`;
  return { ...parsed, address, bytes: network, prefixLength, canonical };
}

export function ipMatchesEntry(ipAddress: unknown, entry: unknown): boolean {
  const ip = parseIpAddress(ipAddress);
  const range = parseIpEntry(entry);
  if (!ip || !range || ip.family !== range.family) return false;
  const masked = maskAddress(ip.bytes, range.prefixLength);
  return masked.every((byte, index) => byte === range.bytes[index]);
}