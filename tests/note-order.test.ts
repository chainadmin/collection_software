import assert from "node:assert/strict";
import test from "node:test";
import { noteTimestamp } from "../shared/note-date";

test("note timestamps preserve time so newly saved notes sort first", () => {
  const earlier = noteTimestamp(new Date("2026-09-10T09:00:00.000Z"));
  const latest = noteTimestamp(new Date("2026-09-10T10:00:00.000Z"));

  assert.equal(earlier, "2026-09-10T09:00:00.000Z");
  assert.equal(latest, "2026-09-10T10:00:00.000Z");
  assert.deepEqual([earlier, latest].sort().reverse(), [latest, earlier]);
});
