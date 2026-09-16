const DMP_FILE_NUMBER_PATTERN = /^(?:FN-\d{4}-)?(\d+)$/;

export type FileNumberRange = {
  start: number;
  end: number;
};

/**
 * Summarizes the numeric file numbers managed by DMP. Vendor-specific file
 * numbers are intentionally excluded because the importer never assigns them.
 */
export function summarizeUsedFileNumbers(fileNumbers: Array<string | null | undefined>) {
  const usedNumbers = Array.from(new Set(fileNumbers.flatMap((fileNumber) => {
    const match = fileNumber?.match(DMP_FILE_NUMBER_PATTERN);
    if (!match) return [];
    const value = Number.parseInt(match[1], 10);
    return Number.isSafeInteger(value) && value > 0 ? [value] : [];
  }))).sort((a, b) => a - b);

  const ranges: FileNumberRange[] = [];
  for (const value of usedNumbers) {
    const previous = ranges[ranges.length - 1];
    if (previous && value === previous.end + 1) {
      previous.end = value;
    } else {
      ranges.push({ start: value, end: value });
    }
  }

  return {
    usedCount: usedNumbers.length,
    highestUsedFileNumber: usedNumbers.at(-1) ?? 0,
    nextFileNumber: (usedNumbers.at(-1) ?? 0) + 1,
    usedFileNumberRanges: ranges,
  };
}
