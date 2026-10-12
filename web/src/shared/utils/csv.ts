type CsvRow = ReadonlyArray<unknown> | null | undefined;
type CsvTable = ReadonlyArray<CsvRow>;

export function formatCsv(
  tableData: CsvTable | null | undefined,
  delimiter = ',',
): string | undefined {
  return tableData
    ?.map((row) =>
      row?.map((rowItem) => `"'${String(rowItem ?? '').replaceAll('"', '""')}"`).join(delimiter),
    )
    ?.join('\n');
}
