type CsvRow = ReadonlyArray<unknown> | null | undefined;
type CsvTable = ReadonlyArray<CsvRow>;

export function formatCsv(
  tableData: CsvTable | null | undefined,
  delimiter = ',',
): string | undefined {
  return tableData
    ?.map((row) =>
      row?.map((rowItem) => (isNaN(rowItem as number) ? `"${rowItem}"` : rowItem)).join(delimiter),
    )
    ?.join('\n');
}
