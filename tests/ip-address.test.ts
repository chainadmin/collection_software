import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeIp,
  canonicalizeWhitelistEntry,
  ipMatchesAny,
  ipMatchesEntry,
} from "../server/ip-address";

test("matches exact IPv4 and IPv4 CIDR boundaries", () => {
  assert.equal(ipMatchesEntry("192.0.2.10", "192.0.2.10"), true);
  assert.equal(ipMatchesEntry("192.0.2.11", "192.0.2.10"), false);
  assert.equal(ipMatchesEntry("10.0.0.0", "10.0.0.17/24"), true);
  assert.equal(ipMatchesEntry("10.0.0.255", "10.0.0.0/24"), true);
  assert.equal(ipMatchesEntry("10.0.1.0", "10.0.0.0/24"), false);
  assert.equal(ipMatchesEntry("255.255.255.255", "0.0.0.0/0"), true);
});

test("canonicalizes and matches compressed IPv6 ranges at boundaries", () => {
  assert.equal(canonicalizeIp("2001:0DB8:0:0:0:0:0:1"), "2001:db8::1");
  assert.equal(canonicalizeWhitelistEntry("2001:db8::1234/64"), "2001:db8::/64");
  assert.equal(ipMatchesEntry("2001:db8::", "2001:db8::/64"), true);
  assert.equal(ipMatchesEntry("2001:db8::ffff:ffff:ffff:ffff", "2001:db8::/64"), true);
  assert.equal(ipMatchesEntry("2001:db8:0:1::", "2001:db8::/64"), false);
  assert.equal(ipMatchesEntry("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "::/0"), true);
});

test("IPv4-mapped IPv6 interoperates with IPv4 entries and CIDRs", () => {
  assert.equal(canonicalizeIp("::ffff:192.0.2.10"), "192.0.2.10");
  assert.equal(canonicalizeIp("::ffff:c000:020a"), "192.0.2.10");
  assert.equal(ipMatchesEntry("::ffff:192.0.2.10", "192.0.2.0/24"), true);
  assert.equal(ipMatchesEntry("192.0.2.10", "::ffff:192.0.2.0/120"), true);
  assert.equal(canonicalizeWhitelistEntry("::ffff:192.0.2.19/120"), "192.0.2.0/24");
});

test("rejects malformed and ambiguous entries", () => {
  for (const entry of [
    "", "1.2.3", "1.2.3.256", "01.2.3.4", "1.2.3.4/33",
    "1.2.3.4/-1", "1.2.3.4/24/1", "2001:::1", "2001:db8::1/129",
    "fe80::1%eth0", "::ffff:192.0.2.1/95", "not-an-ip",
  ]) {
    assert.equal(canonicalizeWhitelistEntry(entry), null, entry);
  }
});

test("an empty whitelist fails closed", () => {
  assert.equal(ipMatchesAny("192.0.2.1", []), false);
  assert.equal(ipMatchesAny("bad", ["0.0.0.0/0"]), false);
});