import assert from "node:assert/strict";
import test from "node:test";
import { ipMatchesEntry, parseIpAddress, parseIpEntry } from "../server/ip-whitelist";

test("canonicalizes IPv4 and CIDR network addresses", () => {
  assert.equal(parseIpAddress(" 192.168.1.4 ")?.address, "192.168.1.4");
  assert.equal(parseIpEntry("192.168.1.99/24")?.canonical, "192.168.1.0/24");
});

test("canonicalizes compressed IPv6 and IPv6 CIDR", () => {
  assert.equal(parseIpAddress("2001:0DB8:0:0:0:0:0:1")?.address, "2001:db8::1");
  assert.equal(parseIpEntry("2001:db8::1234/64")?.canonical, "2001:db8::/64");
});

test("matches exact IPv4 and IPv6 without cross-family false positives", () => {
  assert.equal(ipMatchesEntry("203.0.113.4", "203.0.113.4"), true);
  assert.equal(ipMatchesEntry("203.0.113.5", "203.0.113.4"), false);
  assert.equal(ipMatchesEntry("2001:db8::1", "2001:0db8:0:0::1"), true);
  assert.equal(ipMatchesEntry("2001:db8::1", "203.0.113.1"), false);
});

test("matches IPv4 and IPv6 CIDR boundaries", () => {
  assert.equal(ipMatchesEntry("10.20.30.255", "10.20.30.99/24"), true);
  assert.equal(ipMatchesEntry("10.20.31.0", "10.20.30.0/24"), false);
  assert.equal(ipMatchesEntry("2001:db8:abcd:12::ffff", "2001:db8:abcd:12::/64"), true);
  assert.equal(ipMatchesEntry("2001:db8:abcd:13::", "2001:db8:abcd:12::/64"), false);
});

test("normalizes IPv4-mapped request addresses and rejects malformed entries", () => {
  assert.equal(parseIpAddress("::ffff:192.0.2.8")?.address, "192.0.2.8");
  assert.equal(ipMatchesEntry("::ffff:192.0.2.8", "192.0.2.0/24"), true);
  for (const invalid of ["", "999.1.1.1", "10.0.0.1/33", "2001:db8::/129", "1.2.3.4/24/1", "fe80::1%eth0"]) {
    assert.equal(parseIpEntry(invalid), null);
  }
});