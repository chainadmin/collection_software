import assert from "node:assert/strict";
import test from "node:test";
import { summarizeUsedFileNumbers } from "../server/file-number-summary";

test("summarizes used numeric file numbers into sorted ranges", () => {
  assert.deepEqual(
    summarizeUsedFileNumbers(["5", "1", "2", "FN-2024-0003", "5", "8"]),
    {
      usedCount: 5,
      highestUsedFileNumber: 8,
      nextFileNumber: 9,
      usedFileNumberRanges: [
        { start: 1, end: 3 },
        { start: 5, end: 5 },
        { start: 8, end: 8 },
      ],
    },
  );
});

test("ignores vendor identifiers and invalid numeric values", () => {
  assert.deepEqual(summarizeUsedFileNumbers([null, "", "ABC-12", "0", "-1"]), {
    usedCount: 0,
    highestUsedFileNumber: 0,
    nextFileNumber: 1,
    usedFileNumberRanges: [],
  });
});
