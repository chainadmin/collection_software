import assert from "node:assert/strict";
import test from "node:test";
import { calendarDateFromYmd, easternBusinessDate, localCalendarYmd } from "../shared/business-date";

test("Eastern business date changes at Eastern midnight, not UTC midnight", () => {
  assert.equal(easternBusinessDate(new Date("2025-01-02T04:59:59.000Z")), "2025-01-01");
  assert.equal(easternBusinessDate(new Date("2025-01-02T05:00:00.000Z")), "2025-01-02");
  // In summer the Eastern offset is UTC-4.
  assert.equal(easternBusinessDate(new Date("2025-07-02T03:59:59.000Z")), "2025-07-01");
});

test("calendar serialization uses displayed local calendar parts, not UTC day", () => {
  // Simulate a Date selected by a positive-offset browser: its UTC instant is
  // the prior day, but the visible local selection is still Jan 2.
  const positiveOffsetSelection = new Date("2025-01-01T14:00:00.000Z");
  const displayed = new Date(positiveOffsetSelection.getTime() + 10 * 60 * 60 * 1000);
  assert.equal(localCalendarYmd(displayed), "2025-01-02");
  assert.equal(localCalendarYmd(calendarDateFromYmd("2025-01-02")), "2025-01-02");
});