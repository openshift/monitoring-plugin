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

export function downloadCsv(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  // revoke csv url after 60s to prevent browser memory from filling up
  // with multiple url/blob pairings, which could cause issues if the
  // user is downloading multiple csv's without refreshing the page
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}
