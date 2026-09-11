import assert from "node:assert/strict";
import test from "node:test";

import { formatDate, parseDisplayDate } from "../client/src/lib/utils";

test("date-only values retain their calendar day west of UTC", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";

  try {
    const date = parseDisplayDate("2026-09-11");

    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 11);
    assert.equal(formatDate("2026-09-11"), "Sep 11, 2026");
  } finally {
    process.env.TZ = previousTimezone;
  }
});

test("timestamp values continue to represent instants", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";

  try {
    assert.equal(formatDate("2026-09-11T01:00:00.000Z"), "Sep 10, 2026");
  } finally {
    process.env.TZ = previousTimezone;
  }
});
