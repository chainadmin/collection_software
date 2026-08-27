export type ParsedIp = {
  version: 4 | 6;
  value: bigint;
  bits: 32 | 128;
};

const BI_ZERO = BigInt(0);
const BI_EIGHT = BigInt(8);
const BI_SIXTEEN = BigInt(16);
const BI_255 = BigInt(255);
const BI_65535 = BigInt(65535);
const BI_MAPPED_PREFIX = BigInt(65535);
const BI_IPV4_MASK = BigInt(4294967295);

function parseIpv4(input: string): ParsedIp | null {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(input)) return null;
  const octets = input.split(".").map(Number);
  if (octets.some((part) => part > 255)) return null;
  return {
    version: 4,
    bits: 32,
    value: octets.reduce((value, part) => (value << BI_EIGHT) | BigInt(part), BI_ZERO),
  };
}

function parseIpv6(input: string): ParsedIp | null {
  if (!input || input.includes("%") || input !== input.trim()) return null;
  let source = input.toLowerCase();
  if (source.includes(".")) {
    const lastColon = source.lastIndexOf(":");
    if (lastColon < 0) return null;
    const ipv4 = parseIpv4(source.slice(lastColon + 1));
    if (!ipv4) return null;
    source = `${source.slice(0, lastColon)}:${Number(ipv4.value >> BI_SIXTEEN).toString(16)}:${Number(ipv4.value & BI_65535).toString(16)}`;
  }
  if ((source.match(/::/g) || []).length > 1) return null;
  const compressed = source.includes("::");
  const halves = source.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = compressed && halves[1] ? halves[1].split(":") : [];
  const valid = (part: string) => /^[0-9a-f]{1,4}$/.test(part);
  if (!left.every(valid) || !right.every(valid)) return null;
  if ((!compressed && left.length !== 8) || (compressed && left.length + right.length >= 8)) return null;
  const groups = compressed
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  const value = groups.reduce((result, group) => (result << BI_SIXTEEN) | BigInt(`0x${group}`), BI_ZERO);

  // Treat IPv4-mapped IPv6 as IPv4 so both representations interoperate.
  if ((value >> BigInt(32)) === BI_MAPPED_PREFIX) {
    return { version: 4, bits: 32, value: value & BI_IPV4_MASK };
  }
  return { version: 6, bits: 128, value };
}

export function parseIp(input: unknown): ParsedIp | null {
  if (typeof input !== "string" || !input || input !== input.trim()) return null;
  return input.includes(":") ? parseIpv6(input) : parseIpv4(input);
}

function formatIpv4(value: bigint): string {
  return [BigInt(24), BI_SIXTEEN, BI_EIGHT, BI_ZERO]
    .map((shift) => Number((value >> shift) & BI_255)).join(".");
}

function formatIpv6(value: bigint): string {
  const groups = Array.from({ length: 8 }, (_, index) =>
    Number((value >> BigInt((7 - index) * 16)) & BI_65535).toString(16),
  );
  let bestStart = -1;
  let bestLength = 0;
  for (let start = 0; start < groups.length;) {
    if (groups[start] !== "0") {
      start++;
      continue;
    }
    let end = start;
    while (end < groups.length && groups[end] === "0") end++;
    if (end - start > bestLength && end - start >= 2) {
      bestStart = start;
      bestLength = end - start;
    }
    start = end;
  }
  if (bestStart < 0) return groups.join(":");
  const left = groups.slice(0, bestStart).join(":");
  const right = groups.slice(bestStart + bestLength).join(":");
  return `${left}::${right}`;
}

export function canonicalizeIp(input: unknown): string | null {
  const parsed = parseIp(input);
  if (!parsed) return null;
  return parsed.version === 4 ? formatIpv4(parsed.value) : formatIpv6(parsed.value);
}

export function canonicalizeWhitelistEntry(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const pieces = input.trim().split("/");
  if (pieces.length > 2 || !pieces[0]) return null;
  const parsed = parseIp(pieces[0]);
  if (!parsed) return null;
  if (pieces.length === 1) return parsed.version === 4 ? formatIpv4(parsed.value) : formatIpv6(parsed.value);
  if (!/^(?:0|[1-9]\d*)$/.test(pieces[1])) return null;
  let prefix = Number(pieces[1]);
  // A mapped IPv6 CIDR's first 96 bits are the mapping prefix.
  const mapped = pieces[0].includes(":") && parsed.version === 4;
  if (mapped) {
    if (prefix < 96 || prefix > 128) return null;
    prefix -= 96;
  }
  if (prefix < 0 || prefix > parsed.bits) return null;
  const hostBits = BigInt(parsed.bits - prefix);
  const network = hostBits === BI_ZERO ? parsed.value : (parsed.value >> hostBits) << hostBits;
  const address = parsed.version === 4 ? formatIpv4(network) : formatIpv6(network);
  return `${address}/${prefix}`;
}

export function ipMatchesEntry(ip: unknown, entry: unknown): boolean {
  const address = parseIp(ip);
  const canonicalEntry = canonicalizeWhitelistEntry(entry);
  if (!address || !canonicalEntry) return false;
  const [networkText, prefixText] = canonicalEntry.split("/");
  const network = parseIp(networkText)!;
  if (address.version !== network.version) return false;
  const prefix = prefixText === undefined ? network.bits : Number(prefixText);
  const hostBits = BigInt(network.bits - prefix);
  return hostBits === BI_ZERO
    ? address.value === network.value
    : (address.value >> hostBits) === (network.value >> hostBits);
}

export function ipMatchesAny(ip: unknown, entries: readonly string[]): boolean {
  return entries.some((entry) => ipMatchesEntry(ip, entry));
}