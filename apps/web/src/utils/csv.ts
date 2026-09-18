/**
 * CSV export (Bloco B4 — docs/todo-mvp.md).
 *
 * No external dependency: serializes already-formatted rows and triggers a
 * browser download. Uses `;` as delimiter and a UTF-8 BOM so Excel in pt-BR
 * (decimal comma) opens it correctly without an import wizard.
 */

const DELIMITER = ';';

function escapeCell(value: string): string {
  return /["\n;]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Serializes rows (array of columns) into a CSV string. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(DELIMITER)).join('\r\n');
}

/** Triggers the download of a CSV file built from `rows`. */
export function downloadCsv(filename: string, rows: string[][]): void {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
