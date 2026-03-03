export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const needsSanitize = /^[=+\-@\t\r]/.test(str);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || needsSanitize) {
    return `"${needsSanitize ? "'" : ''}${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const bom = '\uFEFF';
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));
  return bom + [headerLine, ...dataLines].join('\n');
}
